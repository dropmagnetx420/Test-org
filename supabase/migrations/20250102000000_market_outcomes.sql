-- ===========================================================================
-- N-way market outcomes + admin-seeded volume
--
-- `market_options` existed in the initial schema but nothing read or wrote it.
-- This migration makes it the source of truth for outcomes, so a market can be
-- three-way (Home / Draw / Away) instead of only binary YES/NO.
--
-- Seeded volume is kept in its own column: `seed_volume` is what an admin sets
-- to open a market, `real_volume` is what users actually traded. They are never
-- summed into one field at rest, so revenue reporting can exclude seeded numbers.
--
-- The legacy markets.yes_*/no_* columns are kept in sync for binary markets so
-- existing reads keep working during and after rollout.
-- ===========================================================================

-- ------------------------------------------------------------------ markets
alter table public.markets
  add column if not exists outcome_count smallint      not null default 2
    check (outcome_count between 2 and 8),
  add column if not exists seed_volume   numeric(20,2) not null default 0
    check (seed_volume >= 0),
  add column if not exists real_volume   numeric(20,2) not null default 0
    check (real_volume >= 0);

-- ---------------------------------------------------------- market_options
alter table public.market_options
  add column if not exists seed_volume numeric(20,2) not null default 0
    check (seed_volume >= 0),
  add column if not exists real_volume numeric(20,2) not null default 0
    check (real_volume >= 0),
  add column if not exists is_active   boolean not null default true;

-- `volume` from the initial schema is now derived; keep it as a mirror of the
-- sum so any older read still returns something sensible.

create unique index if not exists market_options_position_idx
  on public.market_options(market_id, position);

-- ------------------------------------------------------------------ trades
-- Nullable: trades placed before this migration are backfilled below, and the
-- FK is restrict so an option that carries trade history cannot be deleted.
alter table public.trades
  add column if not exists option_id uuid
    references public.market_options(id) on delete restrict;

-- A "Draw" outcome has no valid trade_side, so `side` stops being mandatory.
-- It is still populated for two-outcome markets to keep older reads working.
alter table public.trades alter column side drop not null;

create index if not exists trades_option_id_idx on public.trades(option_id);

-- ---------------------------------------------------- market resolution
-- resolved_outcome (trade_side) cannot name a third outcome.
alter table public.markets
  add column if not exists resolved_option_id uuid
    references public.market_options(id) on delete set null;

-- ---------------------------------------------------------------- backfill
-- Every pre-existing market becomes an explicit two-outcome market.
insert into public.market_options (market_id, label, odds, volume, seed_volume, real_volume, position, is_winner)
select m.id, m.yes_label, m.yes_odds, m.yes_volume, 0, m.yes_volume, 0,
       m.resolved_outcome = 'yes'
  from public.markets m
 where not exists (
   select 1 from public.market_options o where o.market_id = m.id and o.position = 0
 );

insert into public.market_options (market_id, label, odds, volume, seed_volume, real_volume, position, is_winner)
select m.id, m.no_label, m.no_odds, m.no_volume, 0, m.no_volume, 1,
       m.resolved_outcome = 'no'
  from public.markets m
 where not exists (
   select 1 from public.market_options o where o.market_id = m.id and o.position = 1
 );

update public.markets set real_volume = total_volume where real_volume = 0 and total_volume > 0;

update public.trades t
   set option_id = o.id
  from public.market_options o
 where o.market_id = t.market_id
   and o.position = case when t.side = 'yes' then 0 else 1 end
   and t.option_id is null;

update public.markets m
   set resolved_option_id = o.id
  from public.market_options o
 where o.market_id = m.id
   and o.position = case when m.resolved_outcome = 'yes' then 0 else 1 end
   and m.resolved_outcome is not null
   and m.resolved_option_id is null;

-- --------------------------------------------------------------- earn cap
-- Used by the Task-to-Earn feature; declared here so site_settings stays in one
-- place across migrations.
alter table public.site_settings
  add column if not exists daily_earn_cap numeric(20,2) not null default 5
    check (daily_earn_cap >= 0);
