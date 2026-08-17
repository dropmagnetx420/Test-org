-- =====================================================================
-- NextGen Predict — Live support chat
-- One ongoing conversation per user. Users open a thread from the app;
-- admins reply from the console. Unread counters drive the badges and the
-- rows stream over Supabase realtime (gated by the SELECT policies below).
-- =====================================================================

create table public.support_conversations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.profiles(id) on delete cascade,
  status            text not null default 'open' check (status in ('open', 'closed')),
  last_message_at   timestamptz,
  last_sender_role  text check (last_sender_role in ('user', 'admin', 'system')),
  user_unread       integer not null default 0 check (user_unread >= 0),
  admin_unread      integer not null default 0 check (admin_unread >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index support_conversations_status_idx   on public.support_conversations(status, last_message_at desc nulls last);
create index support_conversations_last_msg_idx  on public.support_conversations(last_message_at desc nulls last);

create table public.support_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.support_conversations(id) on delete cascade,
  sender_id        uuid references public.profiles(id) on delete set null,
  sender_role      text not null check (sender_role in ('user', 'admin', 'system')),
  body             text not null check (char_length(body) between 1 and 2000),
  created_at       timestamptz not null default now(),
  read_at          timestamptz
);

create index support_messages_conversation_idx on public.support_messages(conversation_id, created_at);

create trigger support_conversations_touch before update on public.support_conversations
  for each row execute function public.touch_updated_at();

-- On every new message: advance the thread, flip a closed thread back open when
-- the user writes, and bump the *other* party's unread counter. SECURITY DEFINER
-- so the counter update is not blocked by the sender's own RLS.
create or replace function public.bump_support_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.support_conversations
     set last_message_at  = new.created_at,
         last_sender_role = new.sender_role,
         status           = case when new.sender_role = 'user' and status = 'closed' then 'open' else status end,
         user_unread      = case when new.sender_role in ('admin', 'system') then user_unread + 1 else user_unread end,
         admin_unread     = case when new.sender_role = 'user' then admin_unread + 1 else admin_unread end
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger support_messages_bump
  after insert on public.support_messages
  for each row execute function public.bump_support_conversation();

-- Clearing unread is a definer RPC rather than a broad UPDATE policy, so a user
-- can never touch status or the admin's unread counter on their own row.
create or replace function public.mark_support_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id from public.support_conversations where id = p_conversation_id;
  if v_user_id is null then return; end if;

  if public.is_admin(auth.uid()) then
    update public.support_conversations set admin_unread = 0 where id = p_conversation_id;
    update public.support_messages set read_at = now()
     where conversation_id = p_conversation_id and sender_role = 'user' and read_at is null;
  elsif v_user_id = auth.uid() then
    update public.support_conversations set user_unread = 0 where id = p_conversation_id;
    update public.support_messages set read_at = now()
     where conversation_id = p_conversation_id and sender_role in ('admin', 'system') and read_at is null;
  end if;
end;
$$;

-- ============================================================ ROW SECURITY
alter table public.support_conversations enable row level security;
alter table public.support_messages      enable row level security;

-- conversations: read your own or (admin) all; create only your own thread.
create policy "support_conversations_select" on public.support_conversations
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "support_conversations_insert_own" on public.support_conversations
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user(auth.uid()));

-- Status changes (close/reopen) and any other column edits are admin-only.
-- Users clear unread through mark_support_read(), never a direct UPDATE.
create policy "support_conversations_admin_write" on public.support_conversations
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- messages: read within a thread you own, or any as admin.
create policy "support_messages_select" on public.support_messages
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- A user may only post AS themselves, AS the 'user' role, into their OWN thread.
-- This forbids spoofing sender_role='admin' or writing into someone else's thread.
create policy "support_messages_insert_user" on public.support_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and sender_role = 'user'
    and public.is_active_user(auth.uid())
    and exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create policy "support_messages_insert_admin" on public.support_messages
  for insert to authenticated
  with check (public.is_admin() and sender_id = auth.uid() and sender_role = 'admin');

grant execute on function public.mark_support_read(uuid) to authenticated;

-- ==================================================== REALTIME PUBLICATION
alter publication supabase_realtime add table public.support_conversations;
alter publication supabase_realtime add table public.support_messages;
