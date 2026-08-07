-- =====================================================================
-- NextGen Predict — Row Level Security
-- Money-moving tables are write-locked at the RLS layer; all balance
-- changes flow through SECURITY DEFINER functions only.
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.wallets           enable row level security;
alter table public.markets           enable row level security;
alter table public.market_options    enable row level security;
alter table public.trades            enable row level security;
alter table public.transactions      enable row level security;
alter table public.deposit_addresses enable row level security;
alter table public.deposit_requests  enable row level security;
alter table public.withdraw_requests enable row level security;
alter table public.kyc_requests      enable row level security;
alter table public.notifications     enable row level security;
alter table public.bonus_history     enable row level security;
alter table public.referrals         enable row level security;
alter table public.admin_logs        enable row level security;
alter table public.promo_banners     enable row level security;
alter table public.promo_claims      enable row level security;
alter table public.partners          enable row level security;
alter table public.site_settings     enable row level security;
alter table public.rate_limit_events enable row level security;

-- ------------------------------------------------------------- profiles
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Prevent privilege escalation: a user may not change their own role/status.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
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
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- -------------------------------------------------------------- wallets
create policy "wallets_select_own" on public.wallets
  for select using (user_id = auth.uid() or public.is_admin());

-- No direct INSERT/UPDATE/DELETE: balances only move via SECURITY DEFINER fns.

-- -------------------------------------------------------------- markets
create policy "markets_select_public" on public.markets
  for select using (status <> 'draft' or public.is_admin());

create policy "markets_admin_write" on public.markets
  for all using (public.is_admin()) with check (public.is_admin());

create policy "market_options_select_public" on public.market_options
  for select using (true);

create policy "market_options_admin_write" on public.market_options
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------- trades
create policy "trades_select_own" on public.trades
  for select using (user_id = auth.uid() or public.is_admin());

-- Writes go through place_trade / cancel_trade / resolve_market.

-- --------------------------------------------------------- transactions
create policy "transactions_select_own" on public.transactions
  for select using (user_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------- deposit_addresses
create policy "deposit_addresses_select_active" on public.deposit_addresses
  for select using (is_active or public.is_admin());

create policy "deposit_addresses_admin_write" on public.deposit_addresses
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------ deposit_requests
create policy "deposit_requests_select_own" on public.deposit_requests
  for select using (user_id = auth.uid() or public.is_admin());

create policy "deposit_requests_insert_own" on public.deposit_requests
  for insert with check (
    user_id = auth.uid()
    and status = 'pending'
    and public.is_active_user(auth.uid())
  );

create policy "deposit_requests_admin_update" on public.deposit_requests
  for update using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------- withdraw_requests
create policy "withdraw_requests_select_own" on public.withdraw_requests
  for select using (user_id = auth.uid() or public.is_admin());

create policy "withdraw_requests_admin_update" on public.withdraw_requests
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------- kyc_requests
create policy "kyc_requests_select_own" on public.kyc_requests
  for select using (user_id = auth.uid() or public.is_admin());

create policy "kyc_requests_insert_own" on public.kyc_requests
  for insert with check (
    user_id = auth.uid()
    and status = 'pending'
    and public.is_active_user(auth.uid())
  );

create policy "kyc_requests_admin_update" on public.kyc_requests
  for update using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------- notifications
create policy "notifications_select_own" on public.notifications
  for select using (is_broadcast or user_id = auth.uid() or public.is_admin());

create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notifications_admin_write" on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------- bonus_history
create policy "bonus_history_select_own" on public.bonus_history
  for select using (user_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------ referrals
create policy "referrals_select_own" on public.referrals
  for select using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------- admin_logs
create policy "admin_logs_admin_only" on public.admin_logs
  for select using (public.is_admin());

-- -------------------------------------------------------- promo_banners
create policy "promo_banners_select_active" on public.promo_banners
  for select using (
    public.is_admin()
    or (is_active
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now()))
  );

create policy "promo_banners_admin_write" on public.promo_banners
  for all using (public.is_admin()) with check (public.is_admin());

create policy "promo_claims_select_own" on public.promo_claims
  for select using (user_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------- partners
create policy "partners_select_active" on public.partners
  for select using (is_active or public.is_admin());

create policy "partners_admin_write" on public.partners
  for all using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------- site_settings
create policy "site_settings_select_all" on public.site_settings
  for select using (true);

create policy "site_settings_admin_update" on public.site_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------- rate_limit_events
create policy "rate_limit_admin_only" on public.rate_limit_events
  for select using (public.is_admin());

-- ================================================= GRANTS FOR RPC ACCESS
grant execute on function public.place_trade(uuid, trade_side, numeric)      to authenticated;
grant execute on function public.cancel_trade(uuid)                          to authenticated;
grant execute on function public.create_withdrawal(numeric, network_type, text, text) to authenticated;
grant execute on function public.get_deposit_address(network_type, text)     to authenticated;
grant execute on function public.claim_promo(uuid)                           to authenticated;
grant execute on function public.user_dashboard_stats()                      to authenticated;
grant execute on function public.mark_all_notifications_read()               to authenticated;

grant execute on function public.resolve_market(uuid, trade_side, text)      to authenticated;
grant execute on function public.cancel_market(uuid, text)                   to authenticated;
grant execute on function public.approve_deposit(uuid, text)                 to authenticated;
grant execute on function public.reject_deposit(uuid, text)                  to authenticated;
grant execute on function public.approve_withdrawal(uuid, text, text)        to authenticated;
grant execute on function public.reject_withdrawal(uuid, text)               to authenticated;
grant execute on function public.review_kyc(uuid, boolean, text)             to authenticated;
grant execute on function public.set_user_status(uuid, user_status, text, timestamptz) to authenticated;
grant execute on function public.adjust_user_balance(uuid, numeric, boolean, text)     to authenticated;
grant execute on function public.admin_dashboard_stats()                     to authenticated;
grant execute on function public.close_expired_markets()                     to authenticated;

revoke execute on function public.credit_referral_commission(uuid, numeric) from anon, authenticated;
revoke execute on function public.check_rate_limit(text, text, integer, integer) from anon, authenticated;
revoke execute on function public.recalc_market_odds(uuid) from anon, authenticated;

-- ========================================================= STORAGE SETUP
insert into storage.buckets (id, name, public)
values
  ('kyc-documents',    'kyc-documents',    false),
  ('deposit-receipts', 'deposit-receipts', false),
  ('public-assets',    'public-assets',    true)
on conflict (id) do nothing;

create policy "kyc_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "kyc_read_own_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "receipts_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'deposit-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts_read_own_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'deposit-receipts'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "public_assets_read" on storage.objects
  for select using (bucket_id = 'public-assets');

create policy "public_assets_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-assets' and public.is_admin());

create policy "public_assets_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-assets' and public.is_admin());

-- ==================================================== REALTIME PUBLICATION
alter publication supabase_realtime add table public.markets;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.trades;
alter publication supabase_realtime add table public.wallets;
