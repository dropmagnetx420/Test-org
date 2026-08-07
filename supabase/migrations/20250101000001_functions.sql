-- =====================================================================
-- NextGen Predict — Functions, triggers and atomic money operations
-- =====================================================================

-- --------------------------------------------------- updated_at helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch          before update on public.profiles          for each row execute function public.touch_updated_at();
create trigger wallets_touch           before update on public.wallets           for each row execute function public.touch_updated_at();
create trigger markets_touch           before update on public.markets           for each row execute function public.touch_updated_at();
create trigger trades_touch            before update on public.trades            for each row execute function public.touch_updated_at();
create trigger deposit_requests_touch  before update on public.deposit_requests  for each row execute function public.touch_updated_at();
create trigger withdraw_requests_touch before update on public.withdraw_requests for each row execute function public.touch_updated_at();
create trigger kyc_requests_touch      before update on public.kyc_requests      for each row execute function public.touch_updated_at();
create trigger bonus_history_touch     before update on public.bonus_history     for each row execute function public.touch_updated_at();
create trigger referrals_touch         before update on public.referrals         for each row execute function public.touch_updated_at();
create trigger promo_banners_touch     before update on public.promo_banners     for each row execute function public.touch_updated_at();
create trigger site_settings_touch     before update on public.site_settings     for each row execute function public.touch_updated_at();

-- ------------------------------------------------------- role helpers
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_super_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'super_admin'
  );
$$;

create or replace function public.is_active_user(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and status = 'active'
      and (suspended_until is null or suspended_until < now())
  );
$$;

-- --------------------------------------------------- referral code gen
create or replace function public.generate_referral_code()
returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = candidate);
  end loop;
  return candidate;
end;
$$;

-- -------------------------------------- new auth user -> profile + wallet
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_referrer_id  uuid;
  v_ref_code     text;
  v_welcome      numeric(20,2);
  v_multiplier   numeric(6,2);
  v_settings     public.site_settings%rowtype;
begin
  select * into v_settings from public.site_settings where id = 1;
  v_welcome    := coalesce(v_settings.welcome_bonus, 0);
  v_multiplier := coalesce(v_settings.bonus_turnover_multiplier, 5);

  v_ref_code := upper(nullif(trim(new.raw_user_meta_data->>'referral_code'), ''));
  if v_ref_code is not null then
    select id into v_referrer_id from public.profiles where referral_code = v_ref_code;
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, referral_code, referred_by)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')), ''),
    public.generate_referral_code(),
    v_referrer_id
  );

  insert into public.wallets (user_id, bonus_balance, bonus_turnover_required)
  values (new.id, v_welcome, v_welcome * v_multiplier);

  if v_referrer_id is not null then
    insert into public.referrals (referrer_id, referred_id, code_used)
    values (v_referrer_id, new.id, v_ref_code)
    on conflict (referred_id) do nothing;
  end if;

  if v_welcome > 0 then
    insert into public.bonus_history (user_id, bonus_type, amount, turnover_required, description)
    values (new.id, 'welcome', v_welcome, v_welcome * v_multiplier, 'Welcome bonus');

    insert into public.transactions (user_id, type, amount, balance_before, balance_after, is_bonus, description)
    values (new.id, 'bonus', v_welcome, 0, v_welcome, true, 'Welcome bonus');

    insert into public.notifications (user_id, type, title, message, link)
    values (new.id, 'bonus_credited', 'Welcome bonus credited',
            format('You received a %s USDG welcome bonus.', v_welcome), '/wallet');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------- fee helper
create or replace function public.calc_trade_fee(p_amount numeric)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  s public.site_settings%rowtype;
  v_fee numeric(20,2);
begin
  select * into s from public.site_settings where id = 1;
  v_fee := round(p_amount * coalesce(s.trade_fee_percent, 1) / 100.0, 2);
  v_fee := greatest(v_fee, coalesce(s.trade_fee_min, 0.30));
  v_fee := least(v_fee, coalesce(s.trade_fee_max, 1.00));
  return v_fee;
end;
$$;

create or replace function public.calc_cancel_fee(p_amount numeric)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  s public.site_settings%rowtype;
  v_fee numeric(20,2);
begin
  select * into s from public.site_settings where id = 1;
  v_fee := round(p_amount * coalesce(s.trade_fee_percent, 1) / 100.0, 2);
  v_fee := greatest(v_fee, coalesce(s.cancel_fee_min, 0.30));
  v_fee := least(v_fee, coalesce(s.cancel_fee_max, 1.00));
  return v_fee;
end;
$$;

-- ---------------------------------------------------- odds recalculation
create or replace function public.recalc_market_odds(p_market_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_yes numeric(20,2);
  v_no  numeric(20,2);
  v_liq constant numeric := 500;
  v_yes_odds numeric(6,4);
begin
  select yes_volume, no_volume into v_yes, v_no
  from public.markets where id = p_market_id for update;

  v_yes_odds := (v_yes + v_liq) / ((v_yes + v_liq) + (v_no + v_liq));
  v_yes_odds := greatest(least(v_yes_odds, 0.9900), 0.0100);

  update public.markets
     set yes_odds = round(v_yes_odds, 4),
         no_odds  = round(1 - v_yes_odds, 4)
   where id = p_market_id;
end;
$$;

-- ============================================================ PLACE TRADE
create or replace function public.place_trade(
  p_market_id uuid,
  p_side      trade_side,
  p_amount    numeric
)
returns public.trades
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_profile   public.profiles%rowtype;
  v_market    public.markets%rowtype;
  v_wallet    public.wallets%rowtype;
  v_fee       numeric(20,2);
  v_total     numeric(20,2);
  v_price     numeric(6,4);
  v_shares    numeric(20,4);
  v_payout    numeric(20,2);
  v_from_bonus numeric(20,2) := 0;
  v_from_cash  numeric(20,2) := 0;
  v_before    numeric(20,2);
  v_trade     public.trades%rowtype;
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

  v_price  := case when p_side = 'yes' then v_market.yes_odds else v_market.no_odds end;
  v_shares := round(p_amount / v_price, 4);
  v_payout := round(v_shares, 2);

  v_before := v_wallet.available_balance + v_wallet.bonus_balance;

  update public.wallets
     set available_balance        = available_balance - v_from_cash,
         bonus_balance            = bonus_balance - v_from_bonus,
         bonus_turnover_completed = bonus_turnover_completed + p_amount
   where user_id = v_uid;

  insert into public.trades (
    user_id, market_id, side, amount, price, shares, potential_payout, fee, status
  ) values (
    v_uid, p_market_id, p_side, p_amount, v_price, v_shares, v_payout, v_fee, 'open'
  ) returning * into v_trade;

  update public.markets
     set yes_volume   = yes_volume + case when p_side = 'yes' then p_amount else 0 end,
         no_volume    = no_volume  + case when p_side = 'no'  then p_amount else 0 end,
         total_volume = total_volume + p_amount,
         trade_count  = trade_count + 1
   where id = p_market_id;

  perform public.recalc_market_odds(p_market_id);

  update public.profiles
     set total_trades = total_trades + 1,
         total_volume = total_volume + p_amount
   where id = v_uid;

  insert into public.transactions (user_id, type, amount, balance_before, balance_after, is_bonus, reference_id, reference_type, description)
  values (v_uid, 'trade_buy', -p_amount, v_before, v_before - v_total, v_from_bonus > 0, v_trade.id, 'trade',
          format('%s %s on %s', upper(p_side::text), p_amount, v_market.title));

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

  update public.markets
     set yes_volume   = greatest(yes_volume - case when v_trade.side = 'yes' then v_trade.amount else 0 end, 0),
         no_volume    = greatest(no_volume  - case when v_trade.side = 'no'  then v_trade.amount else 0 end, 0),
         total_volume = greatest(total_volume - v_trade.amount, 0),
         trade_count  = greatest(trade_count - 1, 0)
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
    values (v_uid, 'fee', -v_fee, v_before + v_trade.amount, v_before + v_refund, false, p_trade_id, 'trade', 'Cancellation fee');
  end if;

  return v_trade;
end;
$$;

-- ========================================================= RESOLVE MARKET
create or replace function public.resolve_market(
  p_market_id uuid,
  p_outcome   trade_side,
  p_note      text default null
)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_market  public.markets%rowtype;
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

  for v_trade in
    select * from public.trades where market_id = p_market_id and status = 'open' for update
  loop
    select available_balance + bonus_balance into v_before
      from public.wallets where user_id = v_trade.user_id for update;

    if v_trade.side = p_outcome then
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
              format('Your %s prediction on "%s" did not win.', upper(v_trade.side::text), v_market.title),
              '/dashboard/predictions');
    end if;

    v_count := v_count + 1;
  end loop;

  update public.markets
     set status = 'resolved', resolved_outcome = p_outcome,
         resolved_at = now(), resolved_by = v_uid, resolution_note = p_note
   where id = p_market_id;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'resolve_market', 'market', p_market_id,
          jsonb_build_object('outcome', p_outcome, 'settled_trades', v_count, 'note', p_note));

  return v_count;
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

    update public.wallets
       set available_balance = available_balance + v_trade.amount + v_trade.fee
     where user_id = v_trade.user_id;

    update public.trades
       set status = 'refunded', payout = v_trade.amount + v_trade.fee, settled_at = now()
     where id = v_trade.id;

    insert into public.transactions (user_id, type, amount, balance_before, balance_after, reference_id, reference_type, description)
    values (v_trade.user_id, 'trade_refund', v_trade.amount + v_trade.fee, v_before,
            v_before + v_trade.amount + v_trade.fee, v_trade.id, 'trade',
            format('Market cancelled — refund for "%s"', v_market.title));

    insert into public.notifications (user_id, type, title, message, link)
    values (v_trade.user_id, 'prediction_refunded', 'Market cancelled',
            format('"%s" was cancelled. Your stake was fully refunded.', v_market.title),
            '/dashboard/predictions');

    v_count := v_count + 1;
  end loop;

  update public.markets
     set status = 'cancelled', resolved_at = now(), resolved_by = v_uid, resolution_note = p_note
   where id = p_market_id;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'cancel_market', 'market', p_market_id,
          jsonb_build_object('refunded_trades', v_count, 'note', p_note));

  return v_count;
end;
$$;

-- ==================================================== REFERRAL COMMISSION
create or replace function public.credit_referral_commission(p_user_id uuid, p_volume numeric)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ref     public.referrals%rowtype;
  v_pct     numeric(6,3);
  v_amount  numeric(20,2);
  v_before  numeric(20,2);
begin
  select * into v_ref from public.referrals
   where referred_id = p_user_id and status = 'active' for update;
  if not found then return; end if;

  select referral_commission_percent into v_pct from public.site_settings where id = 1;
  v_amount := round(p_volume * coalesce(v_pct, 0) / 100.0, 2);

  update public.referrals
     set total_volume = total_volume + p_volume,
         commission_earned = commission_earned + v_amount
   where id = v_ref.id;

  if v_amount <= 0 then return; end if;

  select available_balance + bonus_balance into v_before
    from public.wallets where user_id = v_ref.referrer_id for update;

  update public.wallets
     set available_balance = available_balance + v_amount
   where user_id = v_ref.referrer_id;

  insert into public.transactions (user_id, type, amount, balance_before, balance_after, reference_id, reference_type, description)
  values (v_ref.referrer_id, 'referral', v_amount, v_before, v_before + v_amount, p_user_id, 'referral',
          'Referral trading commission');

  insert into public.notifications (user_id, type, title, message, link)
  values (v_ref.referrer_id, 'referral_earned', 'Referral commission',
          format('You earned %s USDG from a referral trade.', v_amount), '/referrals');
end;
$$;

-- ======================================================= APPROVE DEPOSIT
create or replace function public.approve_deposit(p_request_id uuid, p_note text default null)
returns public.deposit_requests
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_req     public.deposit_requests%rowtype;
  v_before  numeric(20,2);
  v_bonus   numeric(20,2) := 0;
  s         public.site_settings%rowtype;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_req from public.deposit_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_REVIEWED' using errcode = '22023';
  end if;

  select * into s from public.site_settings where id = 1;
  v_bonus := round(v_req.amount * coalesce(s.deposit_bonus_percent, 0) / 100.0, 2);

  select available_balance + bonus_balance into v_before
    from public.wallets where user_id = v_req.user_id for update;

  update public.wallets
     set available_balance = available_balance + v_req.amount,
         bonus_balance     = bonus_balance + v_bonus,
         total_deposited   = total_deposited + v_req.amount,
         bonus_turnover_required = bonus_turnover_required
           + (v_bonus * coalesce(s.bonus_turnover_multiplier, 5))
   where user_id = v_req.user_id;

  update public.deposit_requests
     set status = 'approved', bonus_applied = v_bonus, admin_note = p_note,
         reviewed_by = v_uid, reviewed_at = now()
   where id = p_request_id
  returning * into v_req;

  update public.deposit_addresses
     set usage_count = usage_count + 1
   where address = v_req.deposit_address and network = v_req.network;

  insert into public.transactions (user_id, type, amount, balance_before, balance_after, reference_id, reference_type, description)
  values (v_req.user_id, 'deposit', v_req.amount, v_before, v_before + v_req.amount, p_request_id, 'deposit',
          format('Deposit %s %s', v_req.amount, v_req.asset));

  if v_bonus > 0 then
    insert into public.bonus_history (user_id, bonus_type, amount, turnover_required, reference_id, description)
    values (v_req.user_id, 'deposit', v_bonus, v_bonus * coalesce(s.bonus_turnover_multiplier, 5),
            p_request_id, 'Deposit bonus');

    insert into public.transactions (user_id, type, amount, balance_before, balance_after, is_bonus, reference_id, reference_type, description)
    values (v_req.user_id, 'bonus', v_bonus, v_before + v_req.amount, v_before + v_req.amount + v_bonus,
            true, p_request_id, 'deposit', 'Deposit bonus');
  end if;

  insert into public.notifications (user_id, type, title, message, link)
  values (v_req.user_id, 'deposit_approved', 'Deposit approved',
          format('Your deposit of %s %s has been credited.', v_req.amount, v_req.asset), '/wallet');

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'approve_deposit', 'deposit_request', p_request_id,
          jsonb_build_object('amount', v_req.amount, 'bonus', v_bonus));

  return v_req;
end;
$$;

create or replace function public.reject_deposit(p_request_id uuid, p_note text default null)
returns public.deposit_requests
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_req public.deposit_requests%rowtype;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.deposit_requests
     set status = 'rejected', admin_note = p_note, reviewed_by = v_uid, reviewed_at = now()
   where id = p_request_id and status = 'pending'
  returning * into v_req;

  if not found then
    raise exception 'REQUEST_NOT_PENDING' using errcode = '22023';
  end if;

  insert into public.notifications (user_id, type, title, message, link)
  values (v_req.user_id, 'deposit_rejected', 'Deposit rejected',
          coalesce(p_note, 'Your deposit request was rejected. Please contact support.'), '/wallet/deposit');

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'reject_deposit', 'deposit_request', p_request_id, jsonb_build_object('note', p_note));

  return v_req;
end;
$$;

-- ====================================================== WITHDRAWALS
create or replace function public.create_withdrawal(
  p_amount   numeric,
  p_network  network_type,
  p_asset    text,
  p_address  text
)
returns public.withdraw_requests
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_wallet  public.wallets%rowtype;
  s         public.site_settings%rowtype;
  v_fee     numeric(20,2);
  v_net     numeric(20,2);
  v_before  numeric(20,2);
  v_req     public.withdraw_requests%rowtype;
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

  if v_wallet.bonus_turnover_completed < v_wallet.bonus_turnover_required then
    raise exception 'TURNOVER_INCOMPLETE' using errcode = '42501';
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

create or replace function public.approve_withdrawal(
  p_request_id uuid,
  p_tx_hash    text default null,
  p_note       text default null
)
returns public.withdraw_requests
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_req public.withdraw_requests%rowtype;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_req from public.withdraw_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_REVIEWED' using errcode = '22023';
  end if;

  update public.wallets
     set locked_balance  = greatest(locked_balance - v_req.amount, 0),
         total_withdrawn = total_withdrawn + v_req.amount
   where user_id = v_req.user_id;

  update public.withdraw_requests
     set status = 'approved', tx_hash = p_tx_hash, admin_note = p_note,
         reviewed_by = v_uid, reviewed_at = now()
   where id = p_request_id
  returning * into v_req;

  insert into public.notifications (user_id, type, title, message, link)
  values (v_req.user_id, 'withdrawal_approved', 'Withdrawal approved',
          format('Your withdrawal of %s %s has been sent.', v_req.net_amount, v_req.asset), '/wallet');

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'approve_withdrawal', 'withdraw_request', p_request_id,
          jsonb_build_object('amount', v_req.amount, 'tx_hash', p_tx_hash));

  return v_req;
end;
$$;

create or replace function public.reject_withdrawal(p_request_id uuid, p_note text default null)
returns public.withdraw_requests
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_req    public.withdraw_requests%rowtype;
  v_before numeric(20,2);
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_req from public.withdraw_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_REVIEWED' using errcode = '22023';
  end if;

  select available_balance + bonus_balance into v_before
    from public.wallets where user_id = v_req.user_id for update;

  update public.wallets
     set available_balance = available_balance + v_req.amount,
         locked_balance    = greatest(locked_balance - v_req.amount, 0)
   where user_id = v_req.user_id;

  update public.withdraw_requests
     set status = 'rejected', admin_note = p_note, reviewed_by = v_uid, reviewed_at = now()
   where id = p_request_id
  returning * into v_req;

  insert into public.transactions (user_id, type, amount, balance_before, balance_after, reference_id, reference_type, description)
  values (v_req.user_id, 'withdrawal', v_req.amount, v_before, v_before + v_req.amount, p_request_id, 'withdrawal',
          'Withdrawal rejected — funds returned');

  insert into public.notifications (user_id, type, title, message, link)
  values (v_req.user_id, 'withdrawal_rejected', 'Withdrawal rejected',
          coalesce(p_note, 'Your withdrawal request was rejected and funds returned to your balance.'), '/wallet');

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'reject_withdrawal', 'withdraw_request', p_request_id, jsonb_build_object('note', p_note));

  return v_req;
end;
$$;

-- ============================================================ KYC REVIEW
create or replace function public.review_kyc(
  p_request_id uuid,
  p_approve    boolean,
  p_note       text default null
)
returns public.kyc_requests
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_req public.kyc_requests%rowtype;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.kyc_requests
     set status = case when p_approve then 'approved' else 'rejected' end::request_status,
         admin_note = p_note, reviewed_by = v_uid, reviewed_at = now()
   where id = p_request_id and status = 'pending'
  returning * into v_req;

  if not found then
    raise exception 'REQUEST_NOT_PENDING' using errcode = '22023';
  end if;

  update public.profiles
     set kyc_status = case when p_approve then 'approved' else 'rejected' end::kyc_status
   where id = v_req.user_id;

  insert into public.notifications (user_id, type, title, message, link)
  values (
    v_req.user_id,
    case when p_approve then 'kyc_approved' else 'kyc_rejected' end::notification_type,
    case when p_approve then 'KYC approved' else 'KYC rejected' end,
    case when p_approve then 'Your identity has been verified. Withdrawals are now enabled.'
         else coalesce(p_note, 'Your KYC submission was rejected. Please resubmit with clearer documents.') end,
    '/kyc'
  );

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, case when p_approve then 'approve_kyc' else 'reject_kyc' end, 'kyc_request', p_request_id,
          jsonb_build_object('note', p_note));

  return v_req;
end;
$$;

-- =================================================== RANDOM DEPOSIT ADDR
create or replace function public.get_deposit_address(p_network network_type, p_asset text)
returns public.deposit_addresses
language plpgsql stable security definer set search_path = public as $$
declare
  v_row public.deposit_addresses%rowtype;
begin
  select * into v_row
    from public.deposit_addresses
   where network = p_network and asset = p_asset and is_active
   order by random()
   limit 1;

  if not found then
    raise exception 'NO_ADDRESS_AVAILABLE' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

-- ======================================================= PROMO CLAIMING
create or replace function public.claim_promo(p_banner_id uuid)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_banner public.promo_banners%rowtype;
  v_before numeric(20,2);
  s        public.site_settings%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_banner from public.promo_banners where id = p_banner_id for update;
  if not found or not v_banner.is_active then
    raise exception 'PROMO_UNAVAILABLE' using errcode = '22023';
  end if;
  if v_banner.starts_at is not null and now() < v_banner.starts_at then
    raise exception 'PROMO_NOT_STARTED' using errcode = '22023';
  end if;
  if v_banner.ends_at is not null and now() > v_banner.ends_at then
    raise exception 'PROMO_EXPIRED' using errcode = '22023';
  end if;
  if v_banner.user_limit is not null and v_banner.claimed_count >= v_banner.user_limit then
    update public.promo_banners set is_active = false where id = p_banner_id;
    raise exception 'PROMO_LIMIT_REACHED' using errcode = '22023';
  end if;
  if exists (select 1 from public.promo_claims where banner_id = p_banner_id and user_id = v_uid) then
    raise exception 'ALREADY_CLAIMED' using errcode = '23505';
  end if;

  select * into s from public.site_settings where id = 1;

  insert into public.promo_claims (banner_id, user_id, amount)
  values (p_banner_id, v_uid, v_banner.bonus_amount);

  update public.promo_banners
     set claimed_count = claimed_count + 1,
         is_active = case
           when user_limit is not null and claimed_count + 1 >= user_limit then false
           else is_active end
   where id = p_banner_id;

  if v_banner.bonus_amount > 0 then
    select available_balance + bonus_balance into v_before
      from public.wallets where user_id = v_uid for update;

    update public.wallets
       set bonus_balance = bonus_balance + v_banner.bonus_amount,
           bonus_turnover_required = bonus_turnover_required
             + v_banner.bonus_amount * coalesce(s.bonus_turnover_multiplier, 5)
     where user_id = v_uid;

    insert into public.bonus_history (user_id, bonus_type, amount, turnover_required, reference_id, description)
    values (v_uid, 'promo', v_banner.bonus_amount,
            v_banner.bonus_amount * coalesce(s.bonus_turnover_multiplier, 5), p_banner_id, v_banner.title);

    insert into public.transactions (user_id, type, amount, balance_before, balance_after, is_bonus, reference_id, reference_type, description)
    values (v_uid, 'bonus', v_banner.bonus_amount, v_before, v_before + v_banner.bonus_amount,
            true, p_banner_id, 'promo', v_banner.title);

    insert into public.notifications (user_id, type, title, message, link)
    values (v_uid, 'bonus_credited', 'Promo bonus credited',
            format('You claimed %s USDG from "%s".', v_banner.bonus_amount, v_banner.title), '/wallet');
  end if;

  return v_banner.bonus_amount;
end;
$$;

-- ==================================================== ADMIN USER ACTIONS
create or replace function public.set_user_status(
  p_user_id uuid,
  p_status  user_status,
  p_reason  text default null,
  p_until   timestamptz default null
)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_before public.profiles%rowtype;
  v_after  public.profiles%rowtype;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_before from public.profiles where id = p_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_before.role = 'super_admin' and not public.is_super_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.profiles
     set status = p_status,
         ban_reason = case when p_status = 'active' then null else p_reason end,
         suspended_until = case when p_status = 'suspended' then p_until else null end
   where id = p_user_id
  returning * into v_after;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, before_data, after_data)
  values (v_uid, 'set_user_status', 'profile', p_user_id,
          jsonb_build_object('status', v_before.status),
          jsonb_build_object('status', p_status, 'reason', p_reason, 'until', p_until));

  return v_after;
end;
$$;

create or replace function public.adjust_user_balance(
  p_user_id uuid,
  p_amount  numeric,
  p_is_bonus boolean default false,
  p_note    text default null
)
returns public.wallets
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_before numeric(20,2);
  v_wallet public.wallets%rowtype;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select available_balance + bonus_balance into v_before
    from public.wallets where user_id = p_user_id for update;
  if v_before is null then
    raise exception 'WALLET_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.wallets
     set available_balance = case when p_is_bonus then available_balance else available_balance + p_amount end,
         bonus_balance     = case when p_is_bonus then bonus_balance + p_amount else bonus_balance end
   where user_id = p_user_id
  returning * into v_wallet;

  insert into public.transactions (user_id, type, amount, balance_before, balance_after, is_bonus, description)
  values (p_user_id, 'admin_adjustment', p_amount, v_before, v_before + p_amount, p_is_bonus,
          coalesce(p_note, 'Manual balance adjustment'));

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'adjust_balance', 'wallet', p_user_id,
          jsonb_build_object('amount', p_amount, 'is_bonus', p_is_bonus, 'note', p_note));

  return v_wallet;
end;
$$;

-- ==================================================== AUTO-CLOSE MARKETS
create or replace function public.close_expired_markets()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  update public.markets
     set status = 'closed'
   where status = 'open' and end_time <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ==================================================== ADMIN STATS SUMMARY
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_users',        (select count(*) from public.profiles),
    'new_users_today',    (select count(*) from public.profiles where created_at >= current_date),
    'active_users',       (select count(*) from public.profiles where status = 'active'),
    'total_markets',      (select count(*) from public.markets),
    'open_markets',       (select count(*) from public.markets where status = 'open'),
    'total_trades',       (select count(*) from public.trades),
    'total_volume',       (select coalesce(sum(amount), 0) from public.trades where status <> 'cancelled'),
    'volume_today',       (select coalesce(sum(amount), 0) from public.trades where created_at >= current_date and status <> 'cancelled'),
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
    'total_volume',     (select coalesce(sum(amount), 0) from public.trades where user_id = v_uid and status <> 'cancelled'),
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

-- ======================================================== RATE LIMITING
create or replace function public.check_rate_limit(
  p_key       text,
  p_bucket    text,
  p_limit     integer,
  p_window_ms integer
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_since timestamptz := now() - make_interval(secs => p_window_ms / 1000.0);
begin
  delete from public.rate_limit_events where created_at < now() - interval '1 hour';

  select count(*) into v_count
    from public.rate_limit_events
   where key = p_key and bucket = p_bucket and created_at >= v_since;

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_events (key, bucket) values (p_key, p_bucket);
  return true;
end;
$$;

-- ================================================= MARK NOTIFICATIONS READ
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  update public.notifications
     set is_read = true
   where user_id = auth.uid() and not is_read;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
