-- ===========================================================================
-- Price history for the market chart
--
-- Every odds change already funnels through recalc_market_odds(): a user trade,
-- a cancel, an admin seed edit, and the first recalc at market creation all call
-- it. Snapshotting the odds there means the chart fills itself with no extra
-- wiring on any of those paths.
--
-- Rows are written only from inside recalc_market_odds (SECURITY DEFINER), so
-- the table stays append-only from the app's point of view — the public can read
-- it but nothing outside the pricing function can write it.
-- ===========================================================================

create table if not exists public.market_odds_history (
  id          uuid primary key default gen_random_uuid(),
  market_id   uuid not null references public.markets(id)        on delete cascade,
  option_id   uuid not null references public.market_options(id) on delete cascade,
  odds        numeric(6,4) not null,
  recorded_at timestamptz  not null default now()
);

-- The chart reads one market's points in time order; this index serves both the
-- filter and the sort.
create index if not exists market_odds_history_market_time_idx
  on public.market_odds_history(market_id, recorded_at);

alter table public.market_odds_history enable row level security;

-- Odds and timestamps are already public on the market page, so the series is
-- safe to read anonymously.
create policy "market_odds_history_select_public" on public.market_odds_history
  for select using (true);

-- No write policy: only recalc_market_odds (SECURITY DEFINER) inserts rows.

-- ==================================================== RECALC MARKET ODDS
-- Reproduces 20250102000001_market_functions.sql verbatim, then appends a single
-- aligned snapshot of the freshly computed odds. The snapshot is skipped when no
-- price actually moved, so an idempotent recalc never litters the series with
-- duplicate points.
create or replace function public.recalc_market_odds(p_market_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_liq   constant numeric := 500;
  v_total numeric;
  v_count integer;
  v_sum   numeric;
  v_top   uuid;
begin
  select count(*), sum(seed_volume + real_volume + v_liq)
    into v_count, v_total
    from public.market_options
   where market_id = p_market_id and is_active;

  if coalesce(v_count, 0) = 0 or coalesce(v_total, 0) <= 0 then
    return;
  end if;

  -- Clamp keeps a runaway favourite from pricing at 0 or 1, which would make
  -- shares infinite or worthless.
  update public.market_options
     set odds   = greatest(least(round((seed_volume + real_volume + v_liq) / v_total, 4), 0.9900), 0.0100),
         volume = seed_volume + real_volume
   where market_id = p_market_id and is_active;

  -- Rounding and clamping leave the set slightly off 1 (three equal outcomes
  -- round to 0.3333 each = 0.9999). Push the residue onto the favourite so a
  -- bettor cannot arbitrage the gap by backing every outcome.
  select sum(odds) into v_sum from public.market_options
   where market_id = p_market_id and is_active;

  if v_sum is not null and v_sum <> 1 then
    select id into v_top from public.market_options
     where market_id = p_market_id and is_active
     order by odds desc limit 1;

    update public.market_options
       set odds = greatest(least(odds + (1 - v_sum), 0.9900), 0.0100)
     where id = v_top;
  end if;

  -- Mirror onto the legacy columns so two-outcome markets keep working for any
  -- reader that still looks at markets.yes_odds / no_odds.
  update public.markets m
     set yes_odds   = coalesce((select odds from public.market_options where market_id = m.id and position = 0), m.yes_odds),
         no_odds    = coalesce((select odds from public.market_options where market_id = m.id and position = 1), m.no_odds),
         yes_volume = coalesce((select seed_volume + real_volume from public.market_options where market_id = m.id and position = 0), m.yes_volume),
         no_volume  = coalesce((select seed_volume + real_volume from public.market_options where market_id = m.id and position = 1), m.no_volume)
   where m.id = p_market_id and m.outcome_count = 2;

  update public.markets
     set seed_volume  = coalesce((select sum(seed_volume) from public.market_options where market_id = p_market_id), 0),
         real_volume  = coalesce((select sum(real_volume) from public.market_options where market_id = p_market_id), 0),
         total_volume = coalesce((select sum(seed_volume + real_volume) from public.market_options where market_id = p_market_id), 0)
   where id = p_market_id;

  -- Snapshot every active option at one timestamp, but only when at least one
  -- price differs from its last recorded value. Writing the whole set together
  -- keeps the outcomes aligned in time, so the chart's lines share x-values.
  if exists (
    select 1
      from public.market_options o
      left join lateral (
        select h.odds
          from public.market_odds_history h
         where h.option_id = o.id
         order by h.recorded_at desc
         limit 1
      ) last on true
     where o.market_id = p_market_id
       and o.is_active
       and (last.odds is null or last.odds <> o.odds)
  ) then
    insert into public.market_odds_history (market_id, option_id, odds)
    select market_id, id, odds
      from public.market_options
     where market_id = p_market_id and is_active;
  end if;
end;
$$;

-- create or replace keeps existing privileges, but re-state the revoke so the
-- function's access never drifts if this migration is applied on its own.
revoke execute on function public.recalc_market_odds(uuid) from anon, authenticated;

-- Seed one point for every market that already has active options, so existing
-- markets open with a baseline instead of an empty chart.
insert into public.market_odds_history (market_id, option_id, odds)
select market_id, id, odds
  from public.market_options
 where is_active;
