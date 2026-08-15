-- ===========================================================================
-- Consume a promo-banner spot when a deposit is approved
--
-- A promo banner can set a user_limit ("first N people get the offer"), shown to
-- users as "N spots left". Until now that counter (claimed_count) only moved
-- when a user directly claimed a bonus banner via claim_promo(); deposit-driven
-- promotions never counted down. Now the first time any of a user's deposits is
-- approved, every live banner that still has a spot limit loses one spot, and a
-- banner that fills up is deactivated so it stops surfacing.
--
-- Scope (decided with the operator):
--   * all active, in-window banners that have a user_limit — not a subset;
--   * once per user (first approved deposit only), so N spots == N distinct
--     depositors. A user's later deposits do not consume further spots.
--
-- This is the 20250111 approve_deposit body with the banner block added to the
-- first-deposit side effects; the deposit credit, bonuses and referral bounty
-- are unchanged.
-- ===========================================================================

create or replace function public.approve_deposit(p_request_id uuid, p_note text default null)
returns public.deposit_requests
language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_req      public.deposit_requests%rowtype;
  v_before   numeric(20,2);
  v_bonus    numeric(20,2) := 0;
  v_deposited numeric(20,2);
  v_is_first boolean;
  v_label    text;
  s          public.site_settings%rowtype;
  v_ref      public.referrals%rowtype;
  v_ref_before numeric(20,2);
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

  -- Read total_deposited before the credit below moves it. This function is the
  -- only writer of that column, so zero means no deposit has ever been approved.
  select available_balance + bonus_balance, total_deposited
    into v_before, v_deposited
    from public.wallets where user_id = v_req.user_id for update;

  v_is_first := coalesce(v_deposited, 0) = 0;

  if v_is_first then
    v_bonus := round(v_req.amount * coalesce(s.first_deposit_bonus_percent, 0) / 100.0, 2);
    if coalesce(s.first_deposit_bonus_max, 0) > 0 then
      v_bonus := least(v_bonus, s.first_deposit_bonus_max);
    end if;
    v_label := 'First deposit bonus';
  else
    v_bonus := round(v_req.amount * coalesce(s.deposit_bonus_percent, 0) / 100.0, 2);
    v_label := 'Deposit bonus';
  end if;

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
    values (v_req.user_id, case when v_is_first then 'first_deposit' else 'deposit' end,
            v_bonus, v_bonus * coalesce(s.bonus_turnover_multiplier, 5), p_request_id, v_label);

    insert into public.transactions (user_id, type, amount, balance_before, balance_after, is_bonus, reference_id, reference_type, description)
    values (v_req.user_id, 'bonus', v_bonus, v_before + v_req.amount, v_before + v_req.amount + v_bonus,
            true, p_request_id, 'deposit', v_label);
  end if;

  insert into public.notifications (user_id, type, title, message, link)
  values (v_req.user_id, 'deposit_approved', 'Deposit approved',
          case when v_bonus > 0
            then format('Your deposit of %s %s has been credited, plus a %s USDG bonus.',
                        v_req.amount, v_req.asset, v_bonus)
            else format('Your deposit of %s %s has been credited.', v_req.amount, v_req.asset)
          end, '/wallet');

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'approve_deposit', 'deposit_request', p_request_id,
          jsonb_build_object('amount', v_req.amount, 'bonus', v_bonus, 'first_deposit', v_is_first));

  -- Take one promo-banner spot on the user's first approved deposit. Every live,
  -- in-window banner that has a spot limit and still has room loses a spot; a
  -- banner that fills up is deactivated (same rule claim_promo uses). Bounding
  -- this to v_is_first means each user consumes at most one spot per banner, so
  -- the count tracks distinct depositors. claim_promo writes the same counter,
  -- so a user who both claims and deposits on one banner takes two spots there.
  if v_is_first then
    update public.promo_banners
       set claimed_count = claimed_count + 1,
           is_active = case when claimed_count + 1 >= user_limit then false else is_active end
     where is_active
       and user_limit is not null
       and claimed_count < user_limit
       and (starts_at is null or starts_at <= now())
       and (ends_at is null or ends_at >= now());
  end if;

  -- Flat referral bounty. Only on the first deposit, so it pays once per referred
  -- user (there is one referral row per referred_id, guaranteed by the unique
  -- constraint). Independent of the percentage commission on trades.
  if v_is_first and coalesce(s.referral_signup_reward, 0) > 0 then
    select * into v_ref from public.referrals
     where referred_id = v_req.user_id and status = 'active' for update;

    if found then
      select available_balance + bonus_balance into v_ref_before
        from public.wallets where user_id = v_ref.referrer_id for update;

      update public.wallets
         set available_balance = available_balance + s.referral_signup_reward
       where user_id = v_ref.referrer_id;

      update public.referrals
         set commission_earned = commission_earned + s.referral_signup_reward
       where id = v_ref.id;

      insert into public.transactions (user_id, type, amount, balance_before, balance_after, reference_id, reference_type, description)
      values (v_ref.referrer_id, 'referral', s.referral_signup_reward, v_ref_before,
              v_ref_before + s.referral_signup_reward, v_req.user_id, 'referral',
              'Referral signup reward');

      insert into public.notifications (user_id, type, title, message, link)
      values (v_ref.referrer_id, 'referral_earned', 'Referral reward',
              format('You earned %s USDG — a referral made their first deposit.',
                     s.referral_signup_reward), '/referrals');
    end if;
  end if;

  return v_req;
end;
$$;

revoke execute on function public.approve_deposit(uuid, text) from anon, authenticated;
