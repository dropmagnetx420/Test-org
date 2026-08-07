-- =====================================================================
-- NextGen Predict — Earn / ad reward functions
-- All balance changes stay inside SECURITY DEFINER functions; the RLS
-- policies in this file keep the reward tables read-only for users.
-- =====================================================================

-- Shared credit path for every reward this module pays out. `p_as_bonus`
-- routes to bonus_balance (turnover applies) or available_balance.
create or replace function public.credit_reward(
  p_user_id     uuid,
  p_amount      numeric,
  p_ref_id      uuid,
  p_ref_type    text,
  p_bonus_type  text,
  p_description text,
  p_as_bonus    boolean
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_before numeric(20,2);
  v_mult   numeric(6,2);
begin
  if p_amount is null or p_amount <= 0 then
    return;
  end if;

  select coalesce(bonus_turnover_multiplier, 5) into v_mult
    from public.site_settings where id = 1;

  select available_balance + bonus_balance into v_before
    from public.wallets where user_id = p_user_id for update;

  if v_before is null then
    raise exception 'WALLET_NOT_FOUND' using errcode = '22023';
  end if;

  if p_as_bonus then
    update public.wallets
       set bonus_balance = bonus_balance + p_amount,
           bonus_turnover_required = bonus_turnover_required + p_amount * v_mult
     where user_id = p_user_id;

    insert into public.bonus_history
      (user_id, bonus_type, amount, turnover_required, reference_id, description)
    values
      (p_user_id, p_bonus_type, p_amount, p_amount * v_mult, p_ref_id, p_description);
  else
    update public.wallets
       set available_balance = available_balance + p_amount
     where user_id = p_user_id;
  end if;

  insert into public.transactions
    (user_id, type, amount, balance_before, balance_after, is_bonus,
     reference_id, reference_type, description)
  values
    (p_user_id, 'bonus', p_amount, v_before, v_before + p_amount, p_as_bonus,
     p_ref_id, p_ref_type, p_description);
end;
$$;

-- ================================================== USER: SUBMIT A TASK
create or replace function public.submit_task_proof(
  p_task_id    uuid,
  p_proof_url  text default null,
  p_proof_note text default null
)
returns public.task_submissions
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_task public.earn_tasks%rowtype;
  v_sub  public.task_submissions%rowtype;
  v_last timestamptz;
  s      public.site_settings%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if exists (select 1 from public.profiles where id = v_uid and status <> 'active') then
    raise exception 'ACCOUNT_RESTRICTED' using errcode = '42501';
  end if;

  select * into s from public.site_settings where id = 1;
  if not coalesce(s.earn_tasks_enabled, true) then
    raise exception 'TASKS_DISABLED' using errcode = '22023';
  end if;

  select * into v_task from public.earn_tasks where id = p_task_id for update;
  if not found or not v_task.is_active then
    raise exception 'TASK_UNAVAILABLE' using errcode = '22023';
  end if;
  if v_task.starts_at is not null and now() < v_task.starts_at then
    raise exception 'TASK_NOT_STARTED' using errcode = '22023';
  end if;
  if v_task.ends_at is not null and now() > v_task.ends_at then
    raise exception 'TASK_EXPIRED' using errcode = '22023';
  end if;
  if v_task.user_limit is not null and v_task.claimed_count >= v_task.user_limit then
    raise exception 'TASK_LIMIT_REACHED' using errcode = '22023';
  end if;
  if v_task.requires_proof and coalesce(trim(p_proof_url), '') = '' then
    raise exception 'PROOF_REQUIRED' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.task_submissions
     where task_id = p_task_id and user_id = v_uid and status = 'pending'
  ) then
    raise exception 'SUBMISSION_PENDING' using errcode = '23505';
  end if;

  select max(reviewed_at) into v_last
    from public.task_submissions
   where task_id = p_task_id and user_id = v_uid and status = 'approved';

  if v_last is not null then
    if not v_task.is_repeatable then
      raise exception 'ALREADY_COMPLETED' using errcode = '23505';
    end if;
    if now() < v_last + make_interval(hours => v_task.cooldown_hours) then
      raise exception 'TASK_COOLDOWN' using errcode = '22023';
    end if;
  end if;

  insert into public.task_submissions (task_id, user_id, proof_url, proof_note, reward)
  values (p_task_id, v_uid, nullif(trim(p_proof_url), ''), nullif(trim(p_proof_note), ''),
          v_task.reward)
  returning * into v_sub;

  return v_sub;
end;
$$;

-- ============================================= ADMIN: REVIEW SUBMISSION
create or replace function public.review_task_submission(
  p_submission_id uuid,
  p_approve       boolean,
  p_note          text default null
)
returns public.task_submissions
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_sub   public.task_submissions%rowtype;
  v_title text;
  s       public.site_settings%rowtype;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into s from public.site_settings where id = 1;

  update public.task_submissions
     set status = case when p_approve then 'approved' else 'rejected' end::request_status,
         admin_note = p_note, reviewed_by = v_uid, reviewed_at = now()
   where id = p_submission_id and status = 'pending'
  returning * into v_sub;

  if not found then
    raise exception 'REQUEST_NOT_PENDING' using errcode = '22023';
  end if;

  select title into v_title from public.earn_tasks where id = v_sub.task_id;

  if p_approve then
    update public.earn_tasks
       set claimed_count = claimed_count + 1,
           is_active = case
             when user_limit is not null and claimed_count + 1 >= user_limit then false
             else is_active end
     where id = v_sub.task_id;

    perform public.credit_reward(
      v_sub.user_id, v_sub.reward, v_sub.id, 'earn_task', 'task',
      coalesce(v_title, 'Task reward'), coalesce(s.task_reward_is_bonus, true)
    );
  end if;

  insert into public.notifications (user_id, type, title, message, link)
  values (
    v_sub.user_id,
    case when p_approve then 'task_approved' else 'task_rejected' end::notification_type,
    case when p_approve then 'Task approved' else 'Task rejected' end,
    case when p_approve
      then format('%s USDG credited for "%s".', v_sub.reward, coalesce(v_title, 'your task'))
      else coalesce(p_note, format('Your proof for "%s" was rejected.', coalesce(v_title, 'the task')))
    end,
    '/earn'
  );

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, case when p_approve then 'approve_task' else 'reject_task' end,
          'task_submission', p_submission_id, jsonb_build_object('note', p_note));

  return v_sub;
end;
$$;

-- ============================================== USER: CLAIM AD-VIEW REWARD
create or replace function public.claim_ad_reward(
  p_placement ad_placement,
  p_provider  ad_provider default null,
  p_watch_ms  integer default 0
)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_count integer;
  s       public.site_settings%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if exists (select 1 from public.profiles where id = v_uid and status <> 'active') then
    raise exception 'ACCOUNT_RESTRICTED' using errcode = '42501';
  end if;

  select * into s from public.site_settings where id = 1;
  if not coalesce(s.ads_enabled, false) then
    raise exception 'ADS_DISABLED' using errcode = '22023';
  end if;

  -- Trust the server-side minimum, not the client's reported duration.
  if coalesce(p_watch_ms, 0) < s.ad_watch_seconds * 1000 then
    raise exception 'WATCH_TOO_SHORT' using errcode = '22023';
  end if;

  select count(*) into v_count
    from public.ad_views where user_id = v_uid and view_date = v_today;

  if v_count >= s.ad_daily_limit then
    raise exception 'AD_LIMIT_REACHED' using errcode = '22023';
  end if;

  -- day_seq + its unique index make a replayed claim fail instead of paying twice.
  insert into public.ad_views (user_id, placement, provider, reward, watch_ms, view_date, day_seq)
  values (v_uid, p_placement, p_provider, s.ad_reward, p_watch_ms, v_today, v_count + 1);

  perform public.credit_reward(
    v_uid, s.ad_reward, null, 'ad_view', 'ad_watch',
    'Ad view reward', coalesce(s.task_reward_is_bonus, true)
  );

  return s.ad_reward;
end;
$$;

-- ====================================================== ADMIN: AD CONFIG
create or replace function public.admin_set_ad_placement(
  p_placement ad_placement,
  p_provider  ad_provider,
  p_format    ad_format,
  p_unit_id   text default null,
  p_script_url text default null,
  p_script_key text default null,
  p_is_active boolean default false
)
returns public.ad_placements
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.ad_placements%rowtype;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.ad_placements
    (placement, provider, format, unit_id, script_url, script_key, is_active)
  values
    (p_placement, p_provider, p_format, nullif(trim(p_unit_id), ''),
     nullif(trim(p_script_url), ''), nullif(trim(p_script_key), ''), p_is_active)
  on conflict (placement, provider, format) do update
     set unit_id    = excluded.unit_id,
         script_url = excluded.script_url,
         script_key = excluded.script_key,
         is_active  = excluded.is_active
  returning * into v_row;

  -- A placement renders one network at a time.
  if p_is_active then
    update public.ad_placements
       set is_active = false
     where placement = p_placement and id <> v_row.id;
  end if;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'set_ad_placement', 'ad_placement', v_row.id,
          jsonb_build_object('placement', p_placement, 'provider', p_provider,
                             'active', p_is_active));

  return v_row;
end;
$$;
