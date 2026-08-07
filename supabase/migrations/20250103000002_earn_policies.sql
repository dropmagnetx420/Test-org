-- =====================================================================
-- NextGen Predict — RLS for earn tasks, submissions, ads
-- Reward tables are read-only to users: every write goes through the
-- SECURITY DEFINER functions in 20250103000001_earn_functions.sql.
-- =====================================================================

alter table public.earn_tasks       enable row level security;
alter table public.task_submissions enable row level security;
alter table public.ad_placements    enable row level security;
alter table public.ad_views         enable row level security;

-- ----------------------------------------------------------- earn_tasks
create policy "earn_tasks_select_active" on public.earn_tasks
  for select using (is_active or public.is_admin());

create policy "earn_tasks_admin_all" on public.earn_tasks
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------- task_submissions
create policy "task_submissions_select_own" on public.task_submissions
  for select using (user_id = auth.uid() or public.is_admin());

create policy "task_submissions_admin_all" on public.task_submissions
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------- ad_placements
-- Unit IDs are public by nature (they ship in the client bundle), but only
-- the active row is exposed so disabled configs stay private.
create policy "ad_placements_select_active" on public.ad_placements
  for select using (is_active or public.is_admin());

create policy "ad_placements_admin_all" on public.ad_placements
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------- ad_views
create policy "ad_views_select_own" on public.ad_views
  for select using (user_id = auth.uid() or public.is_admin());

create policy "ad_views_admin_all" on public.ad_views
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------- grants
revoke execute on function
  public.credit_reward(uuid, numeric, uuid, text, text, text, boolean)
  from anon, authenticated;

-- ================================================= STORAGE: TASK PROOFS
insert into storage.buckets (id, name, public)
values ('task-proofs', 'task-proofs', false)
on conflict (id) do nothing;

create policy "task_proofs_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "task_proofs_read_own_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
