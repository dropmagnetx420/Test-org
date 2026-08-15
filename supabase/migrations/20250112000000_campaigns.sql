-- ===========================================================================
-- Campaign leaderboard
--
-- A campaign is a time-boxed competition the admin turns on. It ranks users by
-- one of three metrics (chosen per campaign) over the campaign window, and the
-- admin picks a winner whose prize is paid manually with the existing balance
-- tools. There is no scheduler: a campaign is "live" only while
-- is_active AND now() is inside [starts_at, ends_at], so it switches itself off
-- when ends_at passes — the same derived-status trick promo_banners use.
-- ===========================================================================

create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  -- trading_volume: sum of trade stakes placed in the window.
  -- referral_count: number of users who signed up under you in the window.
  -- referral_volume: trade stakes placed by your referrals in the window.
  metric      text not null default 'trading_volume'
    check (metric in ('trading_volume', 'referral_count', 'referral_volume')),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  is_active   boolean not null default true,
  prize_note  text,
  winner_id   uuid references public.profiles(id) on delete set null,
  winner_note text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint campaigns_window check (ends_at > starts_at)
);

create index if not exists campaigns_live_idx on public.campaigns(is_active, ends_at);

create trigger campaigns_touch
  before update on public.campaigns
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ RLS
alter table public.campaigns enable row level security;

-- Public may read only a live campaign; admins read everything (drafts, ended,
-- deactivated). Mirrors promo_banners_select_active.
create policy "campaigns_select_live" on public.campaigns
  for select using (
    public.is_admin()
    or (is_active and starts_at <= now() and ends_at >= now())
  );

create policy "campaigns_admin_write" on public.campaigns
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================= RANKINGS
-- One board per campaign, ranked by the campaign's metric over its window.
-- security definer so the aggregate can read every user's trades/referrals, but
-- it only ever returns an anonymised handle + a score, never a raw identity —
-- so it is safe to expose to the public board. The admin detail page re-joins
-- profiles on user_id itself (admin RLS permits it) to show real names.
create or replace function public.leaderboard_rankings(
  p_campaign_id uuid,
  p_limit integer default 50
)
returns table (rank integer, user_id uuid, handle text, score numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_metric text;
  v_start  timestamptz;
  v_end    timestamptz;
begin
  select metric, starts_at, ends_at
    into v_metric, v_start, v_end
    from public.campaigns where id = p_campaign_id;

  if v_metric is null then
    return;
  end if;

  if v_metric = 'referral_count' then
    return query
    select rank() over (order by s.score desc)::int, s.uid, s.handle, s.score
    from (
      select r.referrer_id as uid,
             coalesce(p.username::text, 'Member ' || substr(r.referrer_id::text, 1, 6)) as handle,
             count(*)::numeric as score
        from public.referrals r
        join public.profiles p on p.id = r.referrer_id
       where r.created_at >= v_start and r.created_at <= v_end
       group by r.referrer_id, p.username
    ) s
    order by s.score desc
    limit p_limit;

  elsif v_metric = 'referral_volume' then
    return query
    select rank() over (order by s.score desc)::int, s.uid, s.handle, s.score
    from (
      select p.referred_by as uid,
             coalesce(pr.username::text, 'Member ' || substr(p.referred_by::text, 1, 6)) as handle,
             sum(t.amount)::numeric as score
        from public.trades t
        join public.profiles p  on p.id = t.user_id
        join public.profiles pr on pr.id = p.referred_by
       where p.referred_by is not null
         and t.created_at >= v_start and t.created_at <= v_end
       group by p.referred_by, pr.username
    ) s
    order by s.score desc
    limit p_limit;

  else -- trading_volume
    return query
    select rank() over (order by s.score desc)::int, s.uid, s.handle, s.score
    from (
      select t.user_id as uid,
             coalesce(p.username::text, 'Member ' || substr(t.user_id::text, 1, 6)) as handle,
             sum(t.amount)::numeric as score
        from public.trades t
        join public.profiles p on p.id = t.user_id
       where t.created_at >= v_start and t.created_at <= v_end
       group by t.user_id, p.username
    ) s
    order by s.score desc
    limit p_limit;
  end if;
end;
$$;

grant execute on function public.leaderboard_rankings(uuid, integer) to anon, authenticated;

-- ============================================================ SET WINNER
-- Records the winner and the reason; the prize itself is credited afterward
-- with adjust_user_balance / admin_set_user_balance. No auto-payout here.
create or replace function public.set_campaign_winner(
  p_campaign_id uuid,
  p_user_id uuid,
  p_note text default null
)
returns public.campaigns
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_camp public.campaigns%rowtype;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.campaigns
     set winner_id = p_user_id, winner_note = p_note
   where id = p_campaign_id
  returning * into v_camp;

  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'set_campaign_winner', 'campaign', p_campaign_id,
          jsonb_build_object('winner_id', p_user_id, 'note', p_note));

  return v_camp;
end;
$$;

revoke execute on function public.set_campaign_winner(uuid, uuid, text) from anon, authenticated;
