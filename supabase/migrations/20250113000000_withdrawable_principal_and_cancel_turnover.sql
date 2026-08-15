-- ===========================================================================
-- Withdrawable principal, bonus release, and cancel turnover
--
-- Three related changes to how bonus turnover gates money movement.
--
-- 1. Deposited principal is always withdrawable. Previously create_withdrawal
--    refused every withdrawal until the whole bonus turnover was met, which
--    locked up the user's own deposit. Now, while turnover is outstanding, a
--    user may withdraw up to their net deposits (deposited − already withdrawn
--    − held in pending withdrawals). Profit earned while a bonus is active, and
--    the bonus itself, stay locked until turnover clears.
--
-- 2. Completing turnover releases the bonus. When bonus_turnover_completed
--    reaches bonus_turnover_required, whatever remains in bonus_balance is moved
--    into available_balance so it can be withdrawn — the "convert to cash" the
--    withdraw screen has always promised. Handled by release_cleared_bonus,
--    invoked from place_trade and cancel_trade (the only writers of completed
--    turnover).
--
-- 3. Cancelling counts toward turnover. A cancel is trading activity (it already
--    grows lifetime_volume and the user's total_volume), so it now ADDS its
--    stake to bonus_turnover_completed instead of removing the buy's
--    contribution. Placing then cancelling therefore counts as 2× the stake.
-- ===========================================================================

-- =================================================== RELEASE CLEARED BONUS
-- Moves the remaining bonus into the withdrawable balance once turnover is met.
-- Idempotent: zeroing bonus_balance means a second call is a no-op.
create or replace function public.release_cleared_bonus(p_uid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_wallet public.wallets%rowtype;
  v_before numeric(20,2);
  v_amount numeric(20,2);
begin
  select * into v_wallet from public.wallets where user_id = p_uid for update;
  if not found then
    return;
  end if;

  if v_wallet.bonus_turnover_required <= 0
     or v_wallet.bonus_turnover_completed < v_wallet.bonus_turnover_required
     or v_wallet.bonus_balance <= 0 then
    return;
  end if;

  v_amount := v_wallet.bonus_balance;
  v_before := v_wallet.available_balance + v_wallet.bonus_balance;

  update public.wallets
     set available_balance = available_balance + bonus_balance,
         bonus_balance     = 0
   where user_id = p_uid;

  -- Total balance is unchanged; the money only moves between buckets.
  insert into public.transactions (user_id, type, amount, balance_before, balance_after, is_bonus, description)
  values (p_uid, 'bonus', v_amount, v_before, v_before, true, 'Bonus unlocked — turnover complete');

  insert into public.notifications (user_id, type, title, message, link)
  values (p_uid, 'bonus_credited', 'Bonus unlocked',
          format('Turnover complete. %s USDG in bonus funds is now withdrawable.', v_amount), '/wallet');
end;
$$;

revoke execute on function public.release_cleared_bonus(uuid) from anon, authenticated;

-- ============================================================ PLACE TRADE
-- Body unchanged from 20250106 except for the release_cleared_bonus call: a buy
-- that pushes completed turnover past the requirement now unlocks the bonus.
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

  -- This buy may have completed the turnover requirement.
  perform public.release_cleared_bonus(v_uid);

  return v_trade;
end;
$$;

-- =========================================================== CANCEL TRADE
-- Same as 20250110 except: cancelling now ADDS its stake to completed turnover
-- (a cancel is trading activity, mirroring how it grows lifetime_volume), and a
-- cancel that clears the requirement releases the bonus.
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
         bonus_turnover_completed = bonus_turnover_completed + v_trade.amount
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

  -- The turnover this cancel added may have completed the requirement.
  perform public.release_cleared_bonus(v_uid);

  return v_trade;
end;
$$;

-- ========================================================= CREATE WITHDRAWAL
-- Body unchanged from 20250101 except the turnover gate: instead of blocking
-- every withdrawal until turnover clears, it only caps the amount at the user's
-- net deposited principal while turnover is outstanding.
create or replace function public.create_withdrawal(
  p_amount   numeric,
  p_network  network_type,
  p_asset    text,
  p_address  text
)
returns public.withdraw_requests
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_profile   public.profiles%rowtype;
  v_wallet    public.wallets%rowtype;
  s           public.site_settings%rowtype;
  v_fee       numeric(20,2);
  v_net       numeric(20,2);
  v_before    numeric(20,2);
  v_principal numeric(20,2);
  v_req       public.withdraw_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.status <> 'active' then
    raise exception 'ACCOUNT_RESTRICTED' using errcode = '42501';
  end if;

  select * into s from public.site_settings where id = 1;

  if s.kyc_required_for_withdrawal and v_profile.kyc_status <> 'approved' then
    raise exception 'KYC_REQUIRED' using errcode = '42501';
  end if;

  p_amount := round(p_amount, 2);
  if p_amount < s.min_withdrawal then
    raise exception 'BELOW_MIN_WITHDRAWAL' using errcode = '22023';
  end if;

  select * into v_wallet from public.wallets where user_id = v_uid for update;

  if v_wallet.available_balance < p_amount then
    raise exception 'INSUFFICIENT_BALANCE' using errcode = '22023';
  end if;

  -- Deposited principal is always withdrawable. While bonus turnover is still
  -- outstanding, cap the withdrawal at net deposits (deposited − already
  -- withdrawn − held in pending withdrawals) so profit and bonus stay locked
  -- until the requirement clears.
  if v_wallet.bonus_turnover_required > 0
     and v_wallet.bonus_turnover_completed < v_wallet.bonus_turnover_required then
    v_principal := greatest(
      v_wallet.total_deposited - v_wallet.total_withdrawn - v_wallet.locked_balance, 0);
    if p_amount > v_principal then
      raise exception 'TURNOVER_INCOMPLETE' using errcode = '42501';
    end if;
  end if;

  v_fee := round(p_amount * coalesce(s.withdrawal_fee_percent, 0) / 100.0, 2);
  v_net := p_amount - v_fee;
  if v_net <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  v_before := v_wallet.available_balance + v_wallet.bonus_balance;

  -- Move funds to locked until admin review completes.
  update public.wallets
     set available_balance = available_balance - p_amount,
         locked_balance    = locked_balance + p_amount
   where user_id = v_uid;

  insert into public.withdraw_requests (user_id, amount, fee, net_amount, network, asset, wallet_address)
  values (v_uid, p_amount, v_fee, v_net, p_network, p_asset, p_address)
  returning * into v_req;

  insert into public.transactions (user_id, type, amount, balance_before, balance_after, reference_id, reference_type, description)
  values (v_uid, 'withdrawal', -p_amount, v_before, v_before - p_amount, v_req.id, 'withdrawal',
          format('Withdrawal request %s %s', p_amount, p_asset));

  return v_req;
end;
$$;
