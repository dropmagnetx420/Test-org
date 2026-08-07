-- =====================================================================
-- NextGen Predict — Core schema
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------- enums
create type user_role       as enum ('user', 'admin', 'super_admin');
create type user_status     as enum ('active', 'suspended', 'banned');
create type kyc_status      as enum ('unverified', 'pending', 'approved', 'rejected');
create type market_status   as enum ('draft', 'open', 'closed', 'resolved', 'cancelled');
create type trade_side      as enum ('yes', 'no');
create type trade_status    as enum ('open', 'cancelled', 'won', 'lost', 'refunded');
create type request_status  as enum ('pending', 'approved', 'rejected');
create type network_type    as enum ('robinhood', 'ethereum');
create type id_document_type as enum ('national_id', 'passport', 'driving_license');

create type transaction_type as enum (
  'deposit', 'withdrawal', 'trade_buy', 'trade_cancel', 'trade_payout',
  'trade_refund', 'fee', 'bonus', 'referral', 'admin_adjustment'
);

create type notification_type as enum (
  'deposit_approved', 'deposit_rejected', 'withdrawal_approved', 'withdrawal_rejected',
  'prediction_won', 'prediction_lost', 'prediction_refunded', 'kyc_approved',
  'kyc_rejected', 'bonus_credited', 'referral_earned', 'announcement'
);

-- ------------------------------------------------------------- profiles
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             citext not null unique,
  username          citext unique,
  full_name         text,
  avatar_url        text,
  phone             text,
  country           text,
  role              user_role   not null default 'user',
  status            user_status not null default 'active',
  kyc_status        kyc_status  not null default 'unverified',
  referral_code     text not null unique,
  referred_by       uuid references public.profiles(id) on delete set null,
  total_trades      integer not null default 0,
  total_volume      numeric(20,2) not null default 0 check (total_volume >= 0),
  total_won         numeric(20,2) not null default 0 check (total_won >= 0),
  total_lost        numeric(20,2) not null default 0 check (total_lost >= 0),
  suspended_until   timestamptz,
  ban_reason        text,
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index profiles_role_idx        on public.profiles(role);
create index profiles_status_idx      on public.profiles(status);
create index profiles_referred_by_idx on public.profiles(referred_by);
create index profiles_created_at_idx  on public.profiles(created_at desc);

-- -------------------------------------------------------------- wallets
create table public.wallets (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null unique references public.profiles(id) on delete cascade,
  available_balance         numeric(20,2) not null default 0 check (available_balance >= 0),
  bonus_balance             numeric(20,2) not null default 0 check (bonus_balance >= 0),
  locked_balance            numeric(20,2) not null default 0 check (locked_balance >= 0),
  total_deposited           numeric(20,2) not null default 0 check (total_deposited >= 0),
  total_withdrawn           numeric(20,2) not null default 0 check (total_withdrawn >= 0),
  bonus_turnover_required   numeric(20,2) not null default 0 check (bonus_turnover_required >= 0),
  bonus_turnover_completed  numeric(20,2) not null default 0 check (bonus_turnover_completed >= 0),
  currency                  text not null default 'USDG',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index wallets_user_id_idx on public.wallets(user_id);

-- -------------------------------------------------------------- markets
create table public.markets (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  sport            text not null,
  league           text,
  title            text not null,
  description      text,
  rules            text,
  image_url        text,
  team_a           text,
  team_b           text,
  team_a_logo      text,
  team_b_logo      text,
  yes_label        text not null default 'YES',
  no_label         text not null default 'NO',
  yes_odds         numeric(6,4) not null default 0.5000 check (yes_odds > 0 and yes_odds < 1),
  no_odds          numeric(6,4) not null default 0.5000 check (no_odds  > 0 and no_odds  < 1),
  yes_volume       numeric(20,2) not null default 0 check (yes_volume >= 0),
  no_volume        numeric(20,2) not null default 0 check (no_volume  >= 0),
  total_volume     numeric(20,2) not null default 0 check (total_volume >= 0),
  trade_count      integer not null default 0,
  min_trade        numeric(20,2) not null default 1,
  max_trade        numeric(20,2) not null default 100000,
  status           market_status not null default 'draft',
  is_featured      boolean not null default false,
  is_trending      boolean not null default false,
  start_time       timestamptz not null,
  end_time         timestamptz not null,
  resolved_outcome trade_side,
  resolved_at      timestamptz,
  resolved_by      uuid references public.profiles(id) on delete set null,
  resolution_note  text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint markets_time_order check (end_time > start_time)
);

create index markets_status_idx     on public.markets(status);
create index markets_sport_idx      on public.markets(sport);
create index markets_end_time_idx   on public.markets(end_time);
create index markets_featured_idx   on public.markets(is_featured) where is_featured;
create index markets_trending_idx   on public.markets(is_trending) where is_trending;
create index markets_open_list_idx  on public.markets(status, end_time desc) where status = 'open';

-- ------------------------------------------------------- market_options
-- Reserved for future multi-outcome markets (currently binary YES/NO).
create table public.market_options (
  id           uuid primary key default gen_random_uuid(),
  market_id    uuid not null references public.markets(id) on delete cascade,
  label        text not null,
  odds         numeric(6,4) not null default 0.5000 check (odds > 0 and odds < 1),
  volume       numeric(20,2) not null default 0 check (volume >= 0),
  is_winner    boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

create index market_options_market_id_idx on public.market_options(market_id);

-- --------------------------------------------------------------- trades
create table public.trades (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  market_id        uuid not null references public.markets(id) on delete cascade,
  side             trade_side not null,
  amount           numeric(20,2) not null check (amount > 0),
  price            numeric(6,4)  not null check (price > 0 and price < 1),
  shares           numeric(20,4) not null check (shares > 0),
  potential_payout numeric(20,2) not null check (potential_payout >= 0),
  fee              numeric(20,2) not null default 0 check (fee >= 0),
  cancel_fee       numeric(20,2) not null default 0 check (cancel_fee >= 0),
  status           trade_status not null default 'open',
  payout           numeric(20,2) not null default 0 check (payout >= 0),
  settled_at       timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index trades_user_id_idx    on public.trades(user_id, created_at desc);
create index trades_market_id_idx  on public.trades(market_id);
create index trades_status_idx     on public.trades(status);
create index trades_open_idx       on public.trades(market_id, status) where status = 'open';

-- --------------------------------------------------------- transactions
create table public.transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  type           transaction_type not null,
  amount         numeric(20,2) not null,
  balance_before numeric(20,2) not null,
  balance_after  numeric(20,2) not null,
  is_bonus       boolean not null default false,
  reference_id   uuid,
  reference_type text,
  description    text,
  created_at     timestamptz not null default now()
);

create index transactions_user_id_idx on public.transactions(user_id, created_at desc);
create index transactions_type_idx    on public.transactions(type);
create index transactions_ref_idx     on public.transactions(reference_id);

-- ----------------------------------------------------- deposit_addresses
create table public.deposit_addresses (
  id          uuid primary key default gen_random_uuid(),
  network     network_type not null,
  asset       text not null,
  address     text not null,
  label       text,
  is_active   boolean not null default true,
  usage_count integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (network, asset, address)
);

create index deposit_addresses_active_idx on public.deposit_addresses(network, asset) where is_active;

-- ------------------------------------------------------ deposit_requests
create table public.deposit_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  amount          numeric(20,2) not null check (amount > 0),
  network         network_type not null,
  asset           text not null,
  tx_hash         text not null,
  deposit_address text not null,
  receipt_url     text,
  status          request_status not null default 'pending',
  bonus_applied   numeric(20,2) not null default 0 check (bonus_applied >= 0),
  admin_note      text,
  reviewed_by     uuid references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint deposit_requests_tx_hash_unique unique (network, tx_hash)
);

create index deposit_requests_user_idx    on public.deposit_requests(user_id, created_at desc);
create index deposit_requests_status_idx  on public.deposit_requests(status, created_at desc);

-- ----------------------------------------------------- withdraw_requests
create table public.withdraw_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  amount         numeric(20,2) not null check (amount > 0),
  fee            numeric(20,2) not null default 0 check (fee >= 0),
  net_amount     numeric(20,2) not null check (net_amount > 0),
  network        network_type not null,
  asset          text not null,
  wallet_address text not null,
  status         request_status not null default 'pending',
  tx_hash        text,
  admin_note     text,
  reviewed_by    uuid references public.profiles(id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index withdraw_requests_user_idx   on public.withdraw_requests(user_id, created_at desc);
create index withdraw_requests_status_idx on public.withdraw_requests(status, created_at desc);

-- ---------------------------------------------------------- kyc_requests
create table public.kyc_requests (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  document_type      id_document_type not null,
  document_number    text not null,
  full_name          text not null,
  date_of_birth      date,
  country            text not null,
  address            text,
  document_front_url text not null,
  document_back_url  text,
  selfie_url         text not null,
  status             request_status not null default 'pending',
  admin_note         text,
  reviewed_by        uuid references public.profiles(id) on delete set null,
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index kyc_requests_user_idx   on public.kyc_requests(user_id, created_at desc);
create index kyc_requests_status_idx on public.kyc_requests(status, created_at desc);
create unique index kyc_requests_one_pending_idx
  on public.kyc_requests(user_id) where status = 'pending';

-- --------------------------------------------------------- notifications
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade,
  type         notification_type not null,
  title        text not null,
  message      text not null,
  link         text,
  is_read      boolean not null default false,
  is_broadcast boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint notifications_target_check
    check ((is_broadcast and user_id is null) or (not is_broadcast and user_id is not null))
);

create index notifications_user_idx      on public.notifications(user_id, created_at desc);
create index notifications_unread_idx    on public.notifications(user_id, is_read) where not is_read;
create index notifications_broadcast_idx on public.notifications(created_at desc) where is_broadcast;

-- --------------------------------------------------------- bonus_history
create table public.bonus_history (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  bonus_type         text not null,
  amount             numeric(20,2) not null check (amount > 0),
  turnover_required  numeric(20,2) not null default 0 check (turnover_required >= 0),
  turnover_completed numeric(20,2) not null default 0 check (turnover_completed >= 0),
  status             text not null default 'active',
  reference_id       uuid,
  description        text,
  expires_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index bonus_history_user_idx on public.bonus_history(user_id, created_at desc);

-- ------------------------------------------------------------ referrals
create table public.referrals (
  id                uuid primary key default gen_random_uuid(),
  referrer_id       uuid not null references public.profiles(id) on delete cascade,
  referred_id       uuid not null unique references public.profiles(id) on delete cascade,
  code_used         text not null,
  commission_earned numeric(20,2) not null default 0 check (commission_earned >= 0),
  total_volume      numeric(20,2) not null default 0 check (total_volume >= 0),
  status            text not null default 'active',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint referrals_no_self check (referrer_id <> referred_id)
);

create index referrals_referrer_idx on public.referrals(referrer_id, created_at desc);

-- ----------------------------------------------------------- admin_logs
create table public.admin_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  before_data jsonb,
  after_data  jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index admin_logs_admin_idx  on public.admin_logs(admin_id, created_at desc);
create index admin_logs_entity_idx on public.admin_logs(entity_type, entity_id);
create index admin_logs_created_idx on public.admin_logs(created_at desc);

-- -------------------------------------------------------- promo_banners
create table public.promo_banners (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  subtitle      text,
  image_url     text,
  link_url      text,
  cta_text      text,
  bg_gradient   text default 'from-violet-600 to-fuchsia-600',
  position      integer not null default 0,
  is_active     boolean not null default true,
  bonus_amount  numeric(20,2) not null default 0 check (bonus_amount >= 0),
  user_limit    integer check (user_limit is null or user_limit > 0),
  claimed_count integer not null default 0 check (claimed_count >= 0),
  starts_at     timestamptz,
  ends_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index promo_banners_active_idx on public.promo_banners(is_active, position);

-- ------------------------------------------------------- promo_claims
create table public.promo_claims (
  id         uuid primary key default gen_random_uuid(),
  banner_id  uuid not null references public.promo_banners(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     numeric(20,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (banner_id, user_id)
);

-- ------------------------------------------------------------- partners
create table public.partners (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text not null,
  website_url text,
  position    integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------- site_settings
create table public.site_settings (
  id                          smallint primary key default 1 check (id = 1),
  site_name                   text not null default 'NextGen Predict',
  site_tagline                text default 'Predict. Trade. Win.',
  logo_url                    text,
  support_email               text,
  twitter_url                 text,
  telegram_url                text,
  discord_url                 text,
  trade_fee_percent           numeric(6,3)  not null default 1.000 check (trade_fee_percent >= 0),
  trade_fee_min               numeric(20,2) not null default 0.30  check (trade_fee_min >= 0),
  trade_fee_max               numeric(20,2) not null default 1.00  check (trade_fee_max >= 0),
  cancel_fee_min              numeric(20,2) not null default 0.30  check (cancel_fee_min >= 0),
  cancel_fee_max              numeric(20,2) not null default 1.00  check (cancel_fee_max >= 0),
  min_deposit                 numeric(20,2) not null default 10    check (min_deposit >= 0),
  min_withdrawal              numeric(20,2) not null default 20    check (min_withdrawal >= 0),
  withdrawal_fee_percent      numeric(6,3)  not null default 0     check (withdrawal_fee_percent >= 0),
  welcome_bonus               numeric(20,2) not null default 0     check (welcome_bonus >= 0),
  deposit_bonus_percent       numeric(6,3)  not null default 0     check (deposit_bonus_percent >= 0),
  bonus_turnover_multiplier   numeric(6,2)  not null default 5     check (bonus_turnover_multiplier >= 0),
  referral_commission_percent numeric(6,3)  not null default 5     check (referral_commission_percent >= 0),
  kyc_required_for_withdrawal boolean not null default true,
  maintenance_mode            boolean not null default false,
  registration_enabled        boolean not null default true,
  updated_at                  timestamptz not null default now(),
  constraint site_settings_fee_range check (trade_fee_max >= trade_fee_min),
  constraint site_settings_cancel_range check (cancel_fee_max >= cancel_fee_min)
);

insert into public.site_settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------- rate_limit_events
create table public.rate_limit_events (
  id         bigserial primary key,
  key        text not null,
  bucket     text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_events_lookup_idx on public.rate_limit_events(key, bucket, created_at desc);
