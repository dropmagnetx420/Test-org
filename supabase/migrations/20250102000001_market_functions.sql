-- ===========================================================================
-- Money RPCs rewritten for N-way outcomes.
--
-- Replaces the binary YES/NO versions from 20250101000001_functions.sql. Every
-- balance mutation still happens inside SECURITY DEFINER functions — the app
-- never writes wallets or volumes directly.
--
-- Pricing is unchanged in spirit: share of liquidity-padded volume. It just
-- sums over market_options rows instead of two hardcoded columns, so it works
-- for 2 outcomes or 8.
-- ===========================================================================

-- The binary resolve_market(uuid, trade_side, text) is dropped rather than kept
-- as an overload: it settles by `trades.side`, which is null on any outcome past
-- the second, so calling it on a three-way market would mark every Draw position
-- as lost. Removing it makes that mistake impossible.
drop function if exists public.resolve_market(uuid, trade_side, text);

-- ==================================================== RECALC MARKET ODDS
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
         volume = seed_volume + real_volume
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
         yes_volume = coalesce((select seed_volume + real_volume from public.market_options where market_id = m.id and position = 0), m.yes_volume),
         no_volume  = coalesce((select seed_volume + real_volume from public.market_options where market_id = m.id and position = 1), m.no_volume)
   where m.id = p_market_id and m.outcome_count = 2;

  update public.markets
     set seed_volume  = coalesce((select sum(seed_volume) from public.market_options where market_id = p_market_id), 0),
         real_volume  = coalesce((select sum(real_volume) from public.market_options where market_id = p_market_id), 0),
         total_volume = coalesce((select sum(seed_volume + real_volume) from public.market_options where market_id = p_market_id), 0)
   where id = p_market_id;
end;
$$;

-- ============================================================ PLACE TRADE
create or replace function public.place_trade(
  p_market_id uuid,
  p_option_id uuid,
  p_amount    numeric
)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare
  v_uid        uuid := auth.uid();
  v_profile    public.profiles%rowtype;
  v_market     public.markets%rowtype;
  v_option     public.market_options%rowtype;
  v_wallet     public.wallets%rowtype;
  v_fee        numeric(20,2);
  v_total      numeric(20,2);
  v_price      numeric(6,4);
  v_shares     numeric(20,4);
  v_payout     numeric(20,2);
  v_from_bonus numeric(20,2) := 0;
  v_from_cash  numeric(20,2) := 0;
  v_before     numeric(20,2);
  v_side       trade_side;
  v_trade      public.trades%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_profile.status <> 'active'
     or (v_profile.suspended_until is not null and v_profile.suspended_until > now()) then
    raise exception 'ACCOUNT_RESTRICTED' using errcode = '42501';
  end if;

  p_amount := round(p_amount, 2);
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  -- Lock market row to serialise concurrent trades on the same market.
  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'MARKET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_market.status <> 'open' then
    raise exception 'MARKET_NOT_OPEN' using errcode = '22023';
  end if;
  if now() >= v_market.end_time then
    raise exception 'MARKET_CLOSED' using errcode = '22023';
  end if;
  if p_amount < v_market.min_trade or p_amount > v_market.max_trade then
    raise exception 'AMOUNT_OUT_OF_RANGE' using errcode = '22023';
  end if;

  select * into v_option from public.market_options
   where id = p_option_id and market_id = p_market_id for update;
  if not found then
    raise exception 'OPTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not v_option.is_active then
    raise exception 'OPTION_NOT_AVAILABLE' using errcode = '22023';
  end if;

  v_fee   := public.calc_trade_fee(p_amount);
  v_total := p_amount + v_fee;

  select * into v_wallet from public.wallets where user_id = v_uid for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if (v_wallet.available_balance + v_wallet.bonus_balance) < v_total then
    raise exception 'INSUFFICIENT_BALANCE' using errcode = '22023';
  end if;

  -- Spend cash first, then bonus.
  v_from_cash  := least(v_wallet.available_balance, v_total);
  v_from_bonus := v_total - v_from_cash;

  v_price  := v_option.odds;
  v_shares := round(p_amount / v_price, 4);
  v_payout := round(v_shares, 2);

  -- Only meaningful for two-outcome markets; a third outcome has no side.
  v_side := case
    when v_market.outcome_count = 2 and v_option.position = 0 then 'yes'::trade_side
    when v_market.outcome_count = 2 and v_option.position = 1 then 'no'::trade_side
    else null
  end;

  v_before := v_wallet.available_balance + v_wallet.bonus_balance;

  update public.wallets
     set available_balance        = available_balance - v_from_cash,
         bonus_balance            = bonus_balance - v_from_bonus,
         bonus_turnover_completed = bonus_turnover_completed + p_amount
   where user_id = v_uid;

  insert into public.trades (
    user_id, market_id, option_id, side, amount, price, shares, potential_payout, fee, status
  ) values (
    v_uid, p_market_id, p_option_id, v_side, p_amount, v_price, v_shares, v_payout, v_fee, 'open'
  ) returning * into v_trade;

  -- Real user money only ever touches real_volume; seed_volume is admin-set.
  update public.market_options
     set real_volume = real_volume + p_amount
   where id = p_option_id;

  update public.markets
     set trade_count = trade_count + 1
   where id = p_market_id;

  perform public.recalc_market_odds(p_market_id);

  update public.profiles
     set total_trades = total_trades + 1,
         total_volume = total_volume + p_amount
   where id = v_uid;

  insert into public.transactions (user_id, type, amount, balance_before, balance_after, is_bonus, reference_id, reference_type, description)
  values (v_uid, 'trade_buy', -p_amount, v_before, v_before - v_total, v_from_bonus > 0, v_trade.id, 'trade',
          format('%s %s on %s', v_option.label, p_amount, v_market.title));

  insert into public.transactions (user_id, type, amount, balance_before, balance_after, is_bonus, reference_id, reference_type, description)
  values (v_uid, 'fee', -v_fee, v_before - p_amount, v_before - v_total, false, v_trade.id, 'trade', 'Trade fee');

  perform public.credit_referral_commission(v_uid, p_amount);

  return v_trade;
end;
$$;

-- Legacy binary entry point, kept so an in-flight client calling with a side
-- keeps working. Resolves the side to the matching option and delegates.
create or replace function public.place_trade(
  p_market_id uuid,
  p_side      trade_side,
  p_amount    numeric
)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare
  v_option_id uuid;
begin
  select id into v_option_id from public.market_options
   where market_id = p_market_id
     and position = case when p_side = 'yes' then 0 else 1 end;

  if v_option_id is null then
    raise exception 'OPTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  return public.place_trade(p_market_id, v_option_id, p_amount);
end;
$$;

-- =========================================================== CANCEL TRADE
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

  update public.market_options
     set real_volume = greatest(real_volume - v_trade.amount, 0)
   where id = v_trade.option_id;

  update public.markets
     set trade_count = greatest(trade_count - 1, 0)
   where id = v_trade.market_id;

  perform public.recalc_market_odds(v_trade.market_id);

  update public.profiles
     set total_trades = greatest(total_trades - 1, 0),
         total_volume = greatest(total_volume - v_trade.amount, 0)
   where id = v_uid;

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

-- ========================================================= RESOLVE MARKET
create or replace function public.resolve_market(
  p_market_id uuid,
  p_option_id uuid,
  p_note      text default null
)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_market  public.markets%rowtype;
  v_option  public.market_options%rowtype;
  v_trade   record;
  v_payout  numeric(20,2);
  v_before  numeric(20,2);
  v_count   integer := 0;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'MARKET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_market.status = 'resolved' then
    raise exception 'ALREADY_RESOLVED' using errcode = '22023';
  end if;

  select * into v_option from public.market_options
   where id = p_option_id and market_id = p_market_id;
  if not found then
    raise exception 'OPTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  for v_trade in
    select * from public.trades where market_id = p_market_id and status = 'open' for update
  loop
    select available_balance + bonus_balance into v_before
      from public.wallets where user_id = v_trade.user_id for update;

    if v_trade.option_id = p_option_id then
      v_payout := v_trade.potential_payout;

      update public.wallets
         set available_balance = available_balance + v_payout
       where user_id = v_trade.user_id;

      update public.trades
         set status = 'won', payout = v_payout, settled_at = now()
       where id = v_trade.id;

      update public.profiles
         set total_won = total_won + greatest(v_payout - v_trade.amount, 0)
       where id = v_trade.user_id;

      insert into public.transactions (user_id, type, amount, balance_before, balance_after, reference_id, reference_type, description)
      values (v_trade.user_id, 'trade_payout', v_payout, v_before, v_before + v_payout, v_trade.id, 'trade',
              format('Won: %s', v_market.title));

      insert into public.notifications (user_id, type, title, message, link)
      values (v_trade.user_id, 'prediction_won', 'Prediction won',
              format('You won %s USDG on "%s".', v_payout, v_market.title),
              '/dashboard/predictions');
    else
      update public.trades
         set status = 'lost', payout = 0, settled_at = now()
       where id = v_trade.id;

      update public.profiles
         set total_lost = total_lost + v_trade.amount
       where id = v_trade.user_id;

      insert into public.notifications (user_id, type, title, message, link)
      values (v_trade.user_id, 'prediction_lost', 'Prediction settled',
              format('Your prediction on "%s" did not win. Result: %s.', v_market.title, v_option.label),
              '/dashboard/predictions');
    end if;

    v_count := v_count + 1;
  end loop;

  update public.market_options
     set is_winner = (id = p_option_id)
   where market_id = p_market_id;

  update public.markets
     set status             = 'resolved',
         resolved_option_id = p_option_id,
         resolved_outcome   = case
           when outcome_count = 2 and v_option.position = 0 then 'yes'::trade_side
           when outcome_count = 2 and v_option.position = 1 then 'no'::trade_side
           else null
         end,
         resolved_at = now(), resolved_by = v_uid, resolution_note = p_note
   where id = p_market_id;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'resolve_market', 'market', p_market_id,
          jsonb_build_object('option_id', p_option_id, 'outcome', v_option.label,
                             'settled_trades', v_count, 'note', p_note));

  return v_count;
end;
$$;

-- ================================================== ADMIN SEEDED VOLUME
-- The only path that can move seeded volume. Real user volume is untouched, so
-- an admin can make a new market look active without corrupting trade figures.
create or replace function public.admin_set_market_volume(
  p_market_id uuid,
  p_seeds     jsonb
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_item jsonb;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- p_seeds: [{ "option_id": "…", "seed_volume": 1250.00 }, …]
  for v_item in select * from jsonb_array_elements(p_seeds)
  loop
    update public.market_options
       set seed_volume = greatest((v_item->>'seed_volume')::numeric, 0)
     where id = (v_item->>'option_id')::uuid
       and market_id = p_market_id;
  end loop;

  perform public.recalc_market_odds(p_market_id);

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'set_market_volume', 'market', p_market_id, jsonb_build_object('seeds', p_seeds));
end;
$$;

-- ========================================================= CANCEL MARKET
-- Unchanged in behaviour (full refund of every open position); repeated here
-- only so the volume reset clears the new columns too.
create or replace function public.cancel_market(p_market_id uuid, p_note text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_market public.markets%rowtype;
  v_trade  record;
  v_before numeric(20,2);
  v_count  integer := 0;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'MARKET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_market.status in ('resolved', 'cancelled') then
    raise exception 'ALREADY_SETTLED' using errcode = '22023';
  end if;

  for v_trade in
    select * from public.trades where market_id = p_market_id and status = 'open' for update
  loop
    select available_balance + bonus_balance into v_before
      from public.wallets where user_id = v_trade.user_id for update;

    -- Full refund including the fee — the market never ran.
    update public.wallets
       set available_balance = available_balance + v_trade.amount + v_trade.fee
     where user_id = v_trade.user_id;

    update public.trades
       set status = 'refunded', payout = v_trade.amount + v_trade.fee, settled_at = now()
     where id = v_trade.id;

    insert into public.transactions (user_id, type, amount, balance_before, balance_after, reference_id, reference_type, description)
    values (v_trade.user_id, 'trade_refund', v_trade.amount + v_trade.fee, v_before,
            v_before + v_trade.amount + v_trade.fee, v_trade.id, 'trade',
            format('Refund: %s', v_market.title));

    insert into public.notifications (user_id, type, title, message, link)
    values (v_trade.user_id, 'prediction_refunded', 'Market cancelled',
            format('"%s" was cancelled and your stake was refunded in full.', v_market.title),
            '/dashboard/predictions');

    v_count := v_count + 1;
  end loop;

  update public.market_options set real_volume = 0 where market_id = p_market_id;

  update public.markets
     set status = 'cancelled', resolution_note = p_note,
         resolved_at = now(), resolved_by = v_uid,
         real_volume = 0, trade_count = 0
   where id = p_market_id;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'cancel_market', 'market', p_market_id,
          jsonb_build_object('refunded_trades', v_count, 'note', p_note));

  return v_count;
end;
$$;
