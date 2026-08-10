-- ===========================================================================
-- Landing page stats aggregate
--
-- getPublicStats() used to select every row of public.markets and sum the
-- volume and per-sport counts in JS. That is an unbounded transfer on the
-- highest-traffic page of the site, and it grew with every market created.
-- The same figures are one indexed aggregate here.
--
-- Only counts and sums are exposed, so this is safe for anon. `total_volume`
-- is seed_volume + lifetime_volume, which is the displayed figure — see
-- 20250106000000_lifetime_volume.sql for why that differs from real_volume.
-- ===========================================================================

create or replace function public.public_stats()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total_volume',     (select coalesce(sum(total_volume), 0) from public.markets),
    'total_trades',     (select count(*) from public.trades),
    'total_users',      (select count(*) from public.profiles),
    'open_markets',     (select count(*) from public.markets where status = 'open'),
    'resolved_markets', (select count(*) from public.markets where status = 'resolved'),
    'sport_counts',     (select coalesce(jsonb_object_agg(sport, n), '{}'::jsonb)
                           from (select sport, count(*) as n
                                   from public.markets
                                  where status = 'open'
                               group by sport) s)
  );
$$;

grant execute on function public.public_stats() to anon, authenticated;

-- Supports the status filters and the per-sport grouping above.
create index if not exists markets_status_sport_idx
  on public.markets (status, sport);
