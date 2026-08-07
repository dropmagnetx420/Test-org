-- =====================================================================
-- Unblock the first super_admin bootstrap.
--
-- guard_profile_update() reverts role/status/ban_reason for any caller
-- that is not already an admin. The server-side service-role client has
-- no auth.uid(), so it failed that check and the owner promotion silently
-- no-opped: the UPDATE reported success while the row never changed. RLS
-- is bypassed by the service role, but triggers are not.
-- =====================================================================

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
