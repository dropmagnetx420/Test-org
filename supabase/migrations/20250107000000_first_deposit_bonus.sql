-- First deposit bonus
--
-- deposit_bonus_percent applied to every deposit equally, so a "match your first
-- deposit" promotion was impossible to run without also matching every deposit
-- after it. These two settings apply to the first approved deposit only.

alter table public.site_settings
  add column if not exists first_deposit_bonus_percent numeric(6,3) not null default 100
    check (first_deposit_bonus_percent >= 0),
  add column if not exists first_deposit_bonus_max numeric(20,2) not null default 100
    check (first_deposit_bonus_max >= 0);

comment on column public.site_settings.first_deposit_bonus_percent is
  'Bonus percent for a user''s first approved deposit. Later deposits use deposit_bonus_percent.';
comment on column public.site_settings.first_deposit_bonus_max is
  'Caps the first deposit bonus. 0 means uncapped.';

-- ======================================================= APPROVE DEPOSIT
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

  return v_req;
end;
$$;
