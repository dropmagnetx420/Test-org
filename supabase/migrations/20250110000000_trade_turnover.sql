-- ===========================================================================
-- Trade turnover: volume only ever grows, count never drops
--
-- Two things are fixed here.
--
-- 1. Regression repair. 20250109_market_odds_history.sql re-created
--    recalc_market_odds from the pre-lifetime_volume version, so displayed
--    volume was again computed from real_volume — which shrinks on cancel. This
--    restores the 20250106 behaviour (display = seed + lifetime_volume) and
--    keeps the odds-history snapshot the chart depends on.
--
-- 2. Turnover on cancel. Closing a position is itself trading activity, so a
--    cancel now ADDS its stake to the displayed volume (lifetime_volume) and the
--    prediction count is left untouched instead of being decremented. real_volume
--    still shrinks, so the odds revert and a large stake cannot be used to move
--    the price and then be withdrawn.
--
--      odds    = seed_volume + real_volume     (open exposure — reverts on cancel)
--      display = seed_volume + lifetime_volume (grows on buy AND on cancel)
-- ===========================================================================

-- ==================================================== RECALC MARKET ODDS
-- 20250106 body (lifetime-based display) + the 20250109 odds snapshot block.
create or replace function public.recalc_market_odds(p_market_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_liq   constant numeric := 500;
  v_total numeric;
  v_count integer;
  v_sum   numeric;
  v_top   uuid;
begin
  select count(*), sum(seed_volume + real_volume + v_liq)
    into v_count, v_total
    from public.market_options
   where market_id = p_market_id and is_active;

  if coalesce(v_count, 0) = 0 or coalesce(v_total, 0) <= 0 then
    return;
  end if;

  -- Clamp keeps a runaway favourite from pricing at 0 or 1, which would make
  -- shares infinite or worthless.
  update public.market_options
     set odds   = greatest(least(round((seed_volume + real_volume + v_liq) / v_total, 4), 0.9900), 0.0100),
         volume = seed_volume + lifetime_volume
   where market_id = p_market_id and is_active;

  -- Rounding and clamping leave the set slightly off 1 (three equal outcomes
  -- round to 0.3333 each = 0.9999). Push the residue onto the favourite so a
  -- bettor cannot arbitrage the gap by backing every outcome.
  select sum(odds) into v_sum from public.market_options
   where market_id = p_market_id and is_active;

  if v_sum is not null and v_sum <> 1 then
    select id into v_top from public.market_options
     where market_id = p_market_id and is_active
     order by odds desc limit 1;

    update public.market_options
       set odds = greatest(least(odds + (1 - v_sum), 0.9900), 0.0100)
     where id = v_top;
  end if;

  -- Mirror onto the legacy columns so two-outcome markets keep working for any
  -- reader that still looks at markets.yes_odds / no_odds.
  update public.markets m
     set yes_odds   = coalesce((select odds from public.market_options where market_id = m.id and position = 0), m.yes_odds),
         no_odds    = coalesce((select odds from public.market_options where market_id = m.id and position = 1), m.no_odds),
         yes_volume = coalesce((select seed_volume + lifetime_volume from public.market_options where market_id = m.id and position = 0), m.yes_volume),
         no_volume  = coalesce((select seed_volume + lifetime_volume from public.market_options where market_id = m.id and position = 1), m.no_volume)
   where m.id = p_market_id and m.outcome_count = 2;

  update public.markets
     set seed_volume     = coalesce((select sum(seed_volume) from public.market_options where market_id = p_market_id), 0),
         real_volume     = coalesce((select sum(real_volume) from public.market_options where market_id = p_market_id), 0),
         lifetime_volume = coalesce((select sum(lifetime_volume) from public.market_options where market_id = p_market_id), 0),
         total_volume    = coalesce((select sum(seed_volume + lifetime_volume) from public.market_options where market_id = p_market_id), 0)
   where id = p_market_id;

  -- Snapshot every active option at one timestamp, but only when at least one
  -- price differs from its last recorded value. Writing the whole set together
  -- keeps the outcomes aligned in time, so the chart's lines share x-values.
  if exists (
    select 1
      from public.market_options o
      left join lateral (
        select h.odds
          from public.market_odds_history h
         where h.option_id = o.id
         order by h.recorded_at desc
         limit 1
      ) last on true
     where o.market_id = p_market_id
       and o.is_active
       and (last.odds is null or last.odds <> o.odds)
  ) then
    insert into public.market_odds_history (market_id, option_id, odds)
    select market_id, id, odds
      from public.market_options
     where market_id = p_market_id and is_active;
  end if;
end;
$$;

-- create or replace preserves privileges, but re-state the revoke so access
-- never drifts if this migration is applied on its own.
revoke execute on function public.recalc_market_odds(uuid) from anon, authenticated;

-- =========================================================== CANCEL TRADE
-- Same as 20250106 except: lifetime_volume grows on cancel, trade_count is no
-- longer decremented, and the user's lifetime volume stat picks up the turnover.
create or replace function public.cancel_trade(p_trade_id uuid)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_trade  public.trades%rowtype;
  v_market public.markets%rowtype;
  v_fee    numeric(20,2);
  v_refund numeric(20,2);
  v_before numeric(20,2);
  v_wallet public.wallets%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'TRADE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_trade.user_id <> v_uid then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_trade.status <> 'open' then
    raise exception 'TRADE_NOT_OPEN' using errcode = '22023';
  end if;

  select * into v_market from public.markets where id = v_trade.market_id for update;
  if v_market.status not in ('open', 'draft') or now() >= v_market.end_time then
    raise exception 'MARKET_CLOSED' using errcode = '22023';
  end if;

  v_fee    := public.calc_cancel_fee(v_trade.amount);
  v_refund := greatest(v_trade.amount - v_fee, 0);

  select * into v_wallet from public.wallets where user_id = v_uid for update;
  v_before := v_wallet.available_balance + v_wallet.bonus_balance;

  update public.wallets
     set available_balance        = available_balance + v_refund,
         bonus_turnover_completed = greatest(bonus_turnover_completed - v_trade.amount, 0)
   where user_id = v_uid;

  update public.trades
     set status       = 'cancelled',
         cancel_fee   = v_fee,
         payout       = v_refund,
         cancelled_at = now()
   where id = p_trade_id
  returning * into v_trade;

  -- real_volume shrinks so the odds move back to where they were (a large stake
  -- can't shift the price and then be withdrawn). lifetime_volume instead GROWS:
  -- closing a position is trading activity, so it adds to displayed turnover the
  -- same way a buy does.
  update public.market_options
     set real_volume     = greatest(real_volume - v_trade.amount, 0),
         lifetime_volume = lifetime_volume + v_trade.amount
   where id = v_trade.option_id;

  -- trade_count is deliberately NOT decremented: a cancelled position stays
  -- counted.

  perform public.recalc_market_odds(v_trade.market_id);

  -- Mirror the turnover onto the user's lifetime volume. guard_profile_update()
  -- reverts this column for non-admins unless app.stats_sync is on.
  perform set_config('app.stats_sync', 'on', true);
  update public.profiles
     set total_volume = total_volume + v_trade.amount
   where id = v_uid;
  perform set_config('app.stats_sync', 'off', true);

  insert into public.transactions (user_id, type, amount, balance_before, balance_after, reference_id, reference_type, description)
  values (v_uid, 'trade_cancel', v_refund, v_before, v_before + v_refund, p_trade_id, 'trade',
          format('Cancelled trade on %s', v_market.title));

  if v_fee > 0 then
    insert into public.transactions (user_id, type, amount, balance_before, balance_after, reference_id, reference_type, description)
    values (v_uid, 'fee', -v_fee, v_before + v_trade.amount, v_before + v_refund, p_trade_id, 'trade', 'Cancellation fee');
  end if;

  return v_trade;
end;
$$;

-- --------------------------------------------------------------- backfill
-- trade_count was decremented on every past cancel; reset it to the true number
-- of positions ever opened on each market.
update public.markets m
   set trade_count = coalesce((select count(*) from public.trades t where t.market_id = m.id), 0);

-- Repair the displayed volume figures the 20250109 regression recomputed from
-- real_volume. Written directly (not via recalc_market_odds) so no live price
-- moves.
update public.market_options set volume = seed_volume + lifetime_volume;

update public.markets m
   set lifetime_volume = coalesce(
         (select sum(o.lifetime_volume) from public.market_options o
           where o.market_id = m.id), 0),
       total_volume = coalesce(
         (select sum(o.seed_volume + o.lifetime_volume) from public.market_options o
           where o.market_id = m.id), 0),
       yes_volume = case when m.outcome_count = 2 then coalesce(
         (select o.seed_volume + o.lifetime_volume from public.market_options o
           where o.market_id = m.id and o.position = 0), m.yes_volume) else m.yes_volume end,
       no_volume  = case when m.outcome_count = 2 then coalesce(
         (select o.seed_volume + o.lifetime_volume from public.market_options o
           where o.market_id = m.id and o.position = 1), m.no_volume) else m.no_volume end;
