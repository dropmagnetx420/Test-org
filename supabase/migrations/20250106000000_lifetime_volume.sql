-- ===========================================================================
-- Lifetime volume + admin balance set/remove
--
-- 1. Volume was rolled back on cancel, so a trade that was opened and then
--    cancelled left no trace in the reported totals. `real_volume` is what
--    prices are made from, so it must keep shrinking when a position closes —
--    otherwise a user could move the odds with a large stake, cancel, and leave
--    the price permanently skewed. So lifetime volume gets its own column that
--    only ever grows, and the displayed figures are made from that instead.
--
--      odds    = seed_volume + real_volume     (open exposure — unchanged)
--      display = seed_volume + lifetime_volume (every trade ever placed)
--
-- 2. wallets has check (available_balance >= 0), so a debit larger than the
--    balance aborted the whole transaction. Debits now clamp at zero, and a new
--    RPC sets a balance to an absolute value.
-- ===========================================================================

-- ------------------------------------------------------------------ columns
alter table public.markets
  add column if not exists lifetime_volume numeric(20,2) not null default 0
    check (lifetime_volume >= 0);

alter table public.market_options
  add column if not exists lifetime_volume numeric(20,2) not null default 0
    check (lifetime_volume >= 0);

-- Backfill from trades rather than from real_volume: real_volume has already
-- had cancelled stakes subtracted out of it, which is the history being fixed.
update public.market_options o
   set lifetime_volume = coalesce(
     (select sum(t.amount) from public.trades t where t.option_id = o.id), 0);

update public.markets m
   set lifetime_volume = coalesce(
     (select sum(o.lifetime_volume) from public.market_options o
       where o.market_id = m.id), 0);

-- Refresh the displayed figures for markets that already exist. Written out
-- rather than calling recalc_market_odds so that no existing price moves —
-- a cancelled market has real_volume 0 and would be repriced by the recalc.
update public.market_options set volume = seed_volume + lifetime_volume;

update public.markets m
   set total_volume = coalesce(
         (select sum(o.seed_volume + o.lifetime_volume) from public.market_options o
           where o.market_id = m.id), 0),
       yes_volume = case when m.outcome_count = 2 then coalesce(
         (select o.seed_volume + o.lifetime_volume from public.market_options o
           where o.market_id = m.id and o.position = 0), m.yes_volume) else m.yes_volume end,
       no_volume  = case when m.outcome_count = 2 then coalesce(
         (select o.seed_volume + o.lifetime_volume from public.market_options o
           where o.market_id = m.id and o.position = 1), m.no_volume) else m.no_volume end;

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
  -- lifetime_volume is the same number but is never given back on cancel.
  update public.market_options
     set real_volume     = real_volume + p_amount,
         lifetime_volume = lifetime_volume + p_amount
   where id = p_option_id;

  update public.markets
     set trade_count = trade_count + 1
   where id = p_market_id;

  perform public.recalc_market_odds(p_market_id);

  -- guard_profile_update() reverts these stat columns for any caller that is
  -- not an admin, which silently swallowed every increment a normal user made.
  -- The flag is transaction-local and set_config is not reachable over
  -- PostgREST, so only these definer functions can raise it.
  perform set_config('app.stats_sync', 'on', true);

  update public.profiles
     set total_trades = total_trades + 1,
         total_volume = total_volume + p_amount
   where id = v_uid;

  perform set_config('app.stats_sync', 'off', true);

  insert into public.transactions (user_id, type, amount, balance_before, balance_after, is_bonus, reference_id, reference_type, description)
  values (v_uid, 'trade_buy', -p_amount, v_before, v_before - v_total, v_from_bonus > 0, v_trade.id, 'trade',
          format('%s %s on %s', v_option.label, p_amount, v_market.title));

  insert into public.transactions (user_id, type, amount, balance_before, balance_after, is_bonus, reference_id, reference_type, description)
  values (v_uid, 'fee', -v_fee, v_before - p_amount, v_before - v_total, false, v_trade.id, 'trade', 'Trade fee');

  perform public.credit_referral_commission(v_uid, p_amount);

  return v_trade;
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

  -- real_volume only: releasing it moves the odds back to where they were, so a
  -- large stake cannot be used to shift the price and then be withdrawn.
  -- lifetime_volume is deliberately left alone.
  update public.market_options
     set real_volume = greatest(real_volume - v_trade.amount, 0)
   where id = v_trade.option_id;

  update public.markets
     set trade_count = greatest(trade_count - 1, 0)
   where id = v_trade.market_id;

  perform public.recalc_market_odds(v_trade.market_id);

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

-- ========================================================= CANCEL MARKET
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
         trade_count = 0
   where id = p_market_id;

  -- Recompute rather than zeroing markets.real_volume by hand, so total_volume
  -- keeps reflecting lifetime_volume instead of going stale.
  perform public.recalc_market_odds(p_market_id);

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'cancel_market', 'market', p_market_id,
          jsonb_build_object('refunded_trades', v_count, 'note', p_note));

  return v_count;
end;
$$;

-- ==================================================== ADMIN STATS SUMMARY
-- Only change from 20250101000001: volume no longer excludes cancelled trades.
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v jsonb;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_users',        (select count(*) from public.profiles),
    'new_users_today',    (select count(*) from public.profiles where created_at >= current_date),
    'active_users',       (select count(*) from public.profiles where status = 'active'),
    'total_markets',      (select count(*) from public.markets),
    'open_markets',       (select count(*) from public.markets where status = 'open'),
    'total_trades',       (select count(*) from public.trades),
    'total_volume',       (select coalesce(sum(amount), 0) from public.trades),
    'volume_today',       (select coalesce(sum(amount), 0) from public.trades where created_at >= current_date),
    'total_fees',         (select coalesce(sum(fee + cancel_fee), 0) from public.trades),
    'fees_today',         (select coalesce(sum(fee + cancel_fee), 0) from public.trades where created_at >= current_date),
    'total_deposits',     (select coalesce(sum(amount), 0) from public.deposit_requests where status = 'approved'),
    'total_withdrawals',  (select coalesce(sum(amount), 0) from public.withdraw_requests where status = 'approved'),
    'pending_deposits',   (select count(*) from public.deposit_requests where status = 'pending'),
    'pending_withdrawals',(select count(*) from public.withdraw_requests where status = 'pending'),
    'pending_kyc',        (select count(*) from public.kyc_requests where status = 'pending'),
    'total_payouts',      (select coalesce(sum(payout), 0) from public.trades where status = 'won'),
    'platform_balance',   (select coalesce(sum(available_balance + bonus_balance + locked_balance), 0) from public.wallets)
  ) into v;

  return v;
end;
$$;

-- ===================================================== USER STATS SUMMARY
create or replace function public.user_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select jsonb_build_object(
    'open_positions',   (select count(*) from public.trades where user_id = v_uid and status = 'open'),
    'open_stake',       (select coalesce(sum(amount), 0) from public.trades where user_id = v_uid and status = 'open'),
    'total_trades',     (select count(*) from public.trades where user_id = v_uid),
    'won_trades',       (select count(*) from public.trades where user_id = v_uid and status = 'won'),
    'lost_trades',      (select count(*) from public.trades where user_id = v_uid and status = 'lost'),
    'total_volume',     (select coalesce(sum(amount), 0) from public.trades where user_id = v_uid),
    'net_profit',       (select coalesce(sum(case when status = 'won' then payout - amount
                                                  when status = 'lost' then -amount else 0 end), 0)
                           from public.trades where user_id = v_uid),
    'unread_notifications', (select count(*) from public.notifications where user_id = v_uid and not is_read),
    'referral_count',   (select count(*) from public.referrals where referrer_id = v_uid),
    'referral_earnings',(select coalesce(sum(commission_earned), 0) from public.referrals where referrer_id = v_uid)
  ) into v;

  return v;
end;
$$;

-- =================================================== PROFILE STAT COLUMNS
-- Same body as 20250104000000 plus an app.stats_sync bypass. Without it the
-- trigger reverted the total_trades/total_volume increments written by
-- place_trade, because a trading user is not an admin — so every profile
-- reported zero volume no matter how much they traded.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_jwt_role text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
begin
  -- security definer rewrites current_user to the function owner, so the
  -- direct-connection case (migrations, SQL editor) is judged on
  -- session_user, and PostgREST requests on the signed JWT role claim.
  -- PostgREST derives that claim from a verified token, so a normal user
  -- cannot present role='service_role'.
  if v_jwt_role = 'service_role'
     or (v_jwt_role is null and session_user in ('postgres', 'supabase_admin'))
     or public.is_admin(auth.uid())
     or current_setting('app.stats_sync', true) = 'on'
  then
    return new;
  end if;

  new.role            := old.role;
  new.status          := old.status;
  new.kyc_status      := old.kyc_status;
  new.referral_code   := old.referral_code;
  new.referred_by     := old.referred_by;
  new.total_trades    := old.total_trades;
  new.total_volume    := old.total_volume;
  new.total_won       := old.total_won;
  new.total_lost      := old.total_lost;
  new.suspended_until := old.suspended_until;
  new.ban_reason      := old.ban_reason;
  new.email           := old.email;

  return new;
end;
$$;

-- Cancelled trades used to subtract themselves back out of the profile totals,
-- and the guard above blocked the increments entirely, so rebuild from trades.
update public.profiles p
   set total_trades = coalesce((select count(*) from public.trades t where t.user_id = p.id), 0),
       total_volume = coalesce((select sum(t.amount) from public.trades t where t.user_id = p.id), 0);

-- ================================================== ADMIN BALANCE CONTROL
-- Debits clamp at zero instead of aborting on the wallets non-negative check,
-- and the ledger records the delta that was actually applied.
create or replace function public.adjust_user_balance(
  p_user_id uuid,
  p_amount  numeric,
  p_is_bonus boolean default false,
  p_note    text default null
)
returns public.wallets
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_before  numeric(20,2);
  v_current numeric(20,2);
  v_new     numeric(20,2);
  v_delta   numeric(20,2);
  v_wallet  public.wallets%rowtype;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  p_amount := round(coalesce(p_amount, 0), 2);

  select available_balance + bonus_balance,
         case when p_is_bonus then bonus_balance else available_balance end
    into v_before, v_current
    from public.wallets where user_id = p_user_id for update;
  if v_before is null then
    raise exception 'WALLET_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_new   := greatest(v_current + p_amount, 0);
  v_delta := v_new - v_current;

  update public.wallets
     set available_balance = case when p_is_bonus then available_balance else v_new end,
         bonus_balance     = case when p_is_bonus then v_new else bonus_balance end
   where user_id = p_user_id
  returning * into v_wallet;

  insert into public.transactions (user_id, type, amount, balance_before, balance_after, is_bonus, description)
  values (p_user_id, 'admin_adjustment', v_delta, v_before, v_before + v_delta, p_is_bonus,
          coalesce(p_note, 'Manual balance adjustment'));

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'adjust_balance', 'wallet', p_user_id,
          jsonb_build_object('requested', p_amount, 'applied', v_delta,
                             'is_bonus', p_is_bonus, 'note', p_note));

  return v_wallet;
end;
$$;

-- Sets one bucket to an absolute figure. Same guards and ledger writes as
-- adjust_user_balance; only the arithmetic differs.
create or replace function public.admin_set_user_balance(
  p_user_id  uuid,
  p_amount   numeric,
  p_is_bonus boolean default false,
  p_note     text default null
)
returns public.wallets
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_before  numeric(20,2);
  v_current numeric(20,2);
  v_delta   numeric(20,2);
  v_wallet  public.wallets%rowtype;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  p_amount := round(coalesce(p_amount, 0), 2);
  if p_amount < 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  select available_balance + bonus_balance,
         case when p_is_bonus then bonus_balance else available_balance end
    into v_before, v_current
    from public.wallets where user_id = p_user_id for update;
  if v_before is null then
    raise exception 'WALLET_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_delta := p_amount - v_current;

  update public.wallets
     set available_balance = case when p_is_bonus then available_balance else p_amount end,
         bonus_balance     = case when p_is_bonus then p_amount else bonus_balance end
   where user_id = p_user_id
  returning * into v_wallet;

  insert into public.transactions (user_id, type, amount, balance_before, balance_after, is_bonus, description)
  values (p_user_id, 'admin_adjustment', v_delta, v_before, v_before + v_delta, p_is_bonus,
          coalesce(p_note, 'Balance set by admin'));

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'set_balance', 'wallet', p_user_id,
          jsonb_build_object('from', v_current, 'to', p_amount,
                             'is_bonus', p_is_bonus, 'note', p_note));

  return v_wallet;
end;
$$;

grant execute on function public.admin_set_user_balance(uuid, numeric, boolean, text) to authenticated;
