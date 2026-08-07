-- =====================================================================
-- NextGen Predict — Earn tasks, ad-watch rewards, ad network config
-- =====================================================================

create type earn_task_type as enum (
  'twitter_follow', 'twitter_retweet', 'telegram_join', 'discord_join',
  'youtube_subscribe', 'instagram_follow', 'facebook_follow', 'custom'
);

create type ad_provider as enum ('admob', 'adsterra', 'startio');

create type ad_placement as enum (
  'header', 'sidebar', 'in_feed', 'footer', 'market_detail', 'earn_page'
);

create type ad_format as enum ('banner', 'native', 'interstitial', 'rewarded_video');

alter type notification_type add value if not exists 'task_approved';
alter type notification_type add value if not exists 'task_rejected';

-- ----------------------------------------------------------- earn_tasks
-- Admin-authored social tasks. `reward` credits as bonus balance so the
-- existing turnover machinery applies before it becomes withdrawable.
create table public.earn_tasks (
  id             uuid primary key default gen_random_uuid(),
  type           earn_task_type not null,
  title          text not null,
  description    text,
  instructions   text,
  target_url     text,
  reward         numeric(20,2) not null default 0 check (reward >= 0),
  requires_proof boolean not null default true,
  is_repeatable  boolean not null default false,
  cooldown_hours integer not null default 24 check (cooldown_hours >= 0),
  user_limit     integer check (user_limit is null or user_limit > 0),
  claimed_count  integer not null default 0 check (claimed_count >= 0),
  is_active      boolean not null default true,
  position       smallint not null default 0,
  starts_at      timestamptz,
  ends_at        timestamptz,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index earn_tasks_active_idx on public.earn_tasks(is_active, position) where is_active;

-- ----------------------------------------------------- task_submissions
create table public.task_submissions (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.earn_tasks(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  proof_url    text,
  proof_note   text,
  status       request_status not null default 'pending',
  reward       numeric(20,2) not null default 0 check (reward >= 0),
  admin_note   text,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index task_submissions_user_idx    on public.task_submissions(user_id, created_at desc);
create index task_submissions_task_idx    on public.task_submissions(task_id);
create index task_submissions_pending_idx on public.task_submissions(status, created_at)
  where status = 'pending';

-- One pending review per task per user; approved rows stay for cooldown checks.
create unique index task_submissions_one_pending
  on public.task_submissions(task_id, user_id) where status = 'pending';

-- --------------------------------------------------------- ad_placements
-- Which network fills which slot. Only one row per placement is enabled.
create table public.ad_placements (
  id          uuid primary key default gen_random_uuid(),
  placement   ad_placement not null,
  provider    ad_provider not null,
  format      ad_format not null default 'banner',
  unit_id     text,
  script_url  text,
  script_key  text,
  is_active   boolean not null default false,
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (placement, provider, format)
);

create index ad_placements_active_idx on public.ad_placements(placement) where is_active;

-- ------------------------------------------------------------- ad_views
-- One row per completed rewarded view. The unique index below is what
-- enforces the daily cap, so a replayed request cannot double-credit.
create table public.ad_views (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  placement   ad_placement not null,
  provider    ad_provider,
  reward      numeric(20,2) not null default 0 check (reward >= 0),
  watch_ms    integer not null default 0 check (watch_ms >= 0),
  view_date   date not null default (now() at time zone 'utc')::date,
  day_seq     integer not null default 1 check (day_seq > 0),
  created_at  timestamptz not null default now()
);

create index ad_views_user_idx on public.ad_views(user_id, created_at desc);

create unique index ad_views_user_day_seq on public.ad_views(user_id, view_date, day_seq);

-- --------------------------------------------------------- site_settings
alter table public.site_settings
  add column if not exists ads_enabled            boolean not null default false,
  add column if not exists ad_reward              numeric(20,2) not null default 0.05
    check (ad_reward >= 0),
  add column if not exists ad_watch_seconds       smallint not null default 20
    check (ad_watch_seconds between 5 and 120),
  add column if not exists ad_daily_limit         smallint not null default 20
    check (ad_daily_limit >= 0),
  add column if not exists earn_tasks_enabled     boolean not null default true,
  add column if not exists task_reward_is_bonus   boolean not null default true;

create trigger earn_tasks_touch       before update on public.earn_tasks
  for each row execute function public.touch_updated_at();
create trigger task_submissions_touch before update on public.task_submissions
  for each row execute function public.touch_updated_at();
create trigger ad_placements_touch    before update on public.ad_placements
  for each row execute function public.touch_updated_at();
