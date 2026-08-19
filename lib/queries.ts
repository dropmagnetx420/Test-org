import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient, createAdminClient, createPublicClient } from "@/lib/supabase/server";
import { CACHE_TAGS, DEFAULTS } from "@/lib/constants";
import type {
  AdPlacementConfig,
  AdPlacementSlot,
  Campaign,
  EarnTask,
  EarnTaskWithState,
  LeaderboardRow,
  LegalPage,
  LegalPageSlug,
  Market,
  MarketOption,
  MarketOddsPoint,
  Paginated,
  Partner,
  PromoBanner,
  RequestStatus,
  TaskSubmission,
  TaskSubmissionWithRelations,
} from "@/types/database";

const MARKET_LIST_COLUMNS =
  "id,slug,sport,league,title,team_a,team_b,yes_label,no_label,yes_odds,no_odds,total_volume,trade_count,status,is_featured,is_trending,start_time,end_time,resolved_outcome";

/**
 * Public reads were hitting Postgres on every request even though the rows only
 * change when an admin edits them. `unstable_cache` holds the result between
 * requests; the `cache` wrapper collapses repeat calls inside a single render.
 * Callbacks must stay cookie-free, hence `createPublicClient`.
 */
function cached<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
  options: { revalidate: number; tags: string[] }
) {
  return cache(unstable_cache(fn, keyParts, options));
}

export const getLiveMarkets = cached(
  async (limit: number = 8): Promise<Market[]> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("markets")
    .select("*")
    .eq("status", "open")
    .gt("end_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(limit);
  return (data as Market[]) ?? [];
  },
  ["live-markets"],
  { revalidate: 30, tags: [CACHE_TAGS.MARKETS] }
);

export const getTrendingMarkets = cached(
  async (limit: number = 8): Promise<Market[]> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("markets")
    .select("*")
    .eq("status", "open")
    .order("is_trending", { ascending: false })
    .order("total_volume", { ascending: false })
    .limit(limit);
  return (data as Market[]) ?? [];
  },
  ["trending-markets"],
  { revalidate: 30, tags: [CACHE_TAGS.MARKETS] }
);

export const getFeaturedMarkets = cached(
  async (limit: number = 4): Promise<Market[]> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("markets")
    .select("*")
    .eq("status", "open")
    .eq("is_featured", true)
    .order("start_time", { ascending: true })
    .limit(limit);
  return (data as Market[]) ?? [];
  },
  ["featured-markets"],
  { revalidate: 60, tags: [CACHE_TAGS.MARKETS] }
);

export const getActiveBanners = cached(
  async (): Promise<PromoBanner[]> => {
  const supabase = createPublicClient();
  // claim_promo enforces the window too, so an unfiltered banner would render
  // and then fail with PROMO_EXPIRED on click.
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("promo_banners")
    .select("*")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("position", { ascending: true });
  return (data as PromoBanner[]) ?? [];
  },
  ["active-banners"],
  { revalidate: 60, tags: [CACHE_TAGS.BANNERS] }
);

export const getPartners = cached(
  async (): Promise<Partner[]> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("partners")
    .select("*")
    .eq("is_active", true)
    .order("position", { ascending: true });
  return (data as Partner[]) ?? [];
  },
  ["partners"],
  { revalidate: 300, tags: [CACHE_TAGS.PARTNERS] }
);

export const getLegalPage = cached(
  async (slug: LegalPageSlug): Promise<LegalPage | null> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("legal_pages")
      .select("*")
      .eq("slug", slug)
      .single();
    return (data as LegalPage) ?? null;
  },
  ["legal-page"],
  { revalidate: 300, tags: [CACHE_TAGS.LEGAL] }
);

/**
 * The single campaign that is live right now. `campaigns_select_live` only
 * exposes an in-window, active row to `anon`, so a cookie-free read returns the
 * live one or nothing — no need to re-check the window here.
 */
export const getLiveCampaign = cached(
  async (): Promise<Campaign | null> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as Campaign | null) ?? null;
  },
  ["live-campaign"],
  { revalidate: 60, tags: [CACHE_TAGS.CAMPAIGNS] }
);

/**
 * Ranked standings for a campaign. The RPC is granted to `anon`, returns only an
 * anonymised handle + score, and is parametrised, so it stays uncached and
 * cookie-free — always fresh for whoever is watching the board.
 */
export async function getCampaignLeaderboard(
  campaignId: string,
  limit = 50
): Promise<LeaderboardRow[]> {
  const supabase = createPublicClient();
  const { data } = await supabase.rpc("leaderboard_rankings", {
    p_campaign_id: campaignId,
    p_limit: limit,
  });
  return (data as LeaderboardRow[]) ?? [];
}

export interface PublicStats {
  totalVolume: number;
  totalTrades: number;
  totalUsers: number;
  openMarkets: number;
  resolvedMarkets: number;
  sportCounts: Record<string, number>;
}

/**
 * Aggregate figures for the landing page. `public_stats()` is security definer
 * because `profiles` is not readable by anonymous visitors — only counts leave
 * the function. Aggregating in SQL keeps this off the markets table scan it
 * used to do on every request.
 */
export const getPublicStats = cached(
  async (): Promise<PublicStats> => {
  const empty: PublicStats = {
    totalVolume: 0,
    totalTrades: 0,
    totalUsers: 0,
    openMarkets: 0,
    resolvedMarkets: 0,
    sportCounts: {},
  };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("public_stats");
    if (error || !data) return empty;

    const row = data as {
      total_volume: string | number;
      total_trades: number;
      total_users: number;
      open_markets: number;
      resolved_markets: number;
      sport_counts: Record<string, number>;
    };

    return {
      totalVolume: Number(row.total_volume ?? 0),
      totalTrades: row.total_trades ?? 0,
      totalUsers: row.total_users ?? 0,
      openMarkets: row.open_markets ?? 0,
      resolvedMarkets: row.resolved_markets ?? 0,
      sportCounts: row.sport_counts ?? {},
    };
  } catch {
    return empty;
  }
  },
  ["public-stats"],
  { revalidate: 60, tags: [CACHE_TAGS.STATS] }
);

export interface MarketFilters {
  sport?: string;
  status?: string;
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export const listMarkets = cached(
  async (filters: MarketFilters = {}): Promise<Paginated<Market>> => {
    const supabase = createPublicClient();
  const pageSize = filters.pageSize ?? DEFAULTS.PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;

  let query = supabase.from("markets").select(MARKET_LIST_COLUMNS, { count: "exact" });

  if (filters.sport) query = query.eq("sport", filters.sport);
  if (filters.status) query = query.eq("status", filters.status);
  else query = query.in("status", ["open", "closed", "resolved"]);
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, "").slice(0, 80);
    if (term) query = query.or(`title.ilike.%${term}%,league.ilike.%${term}%`);
  }

  switch (filters.sort) {
    case "volume":
      query = query.order("total_volume", { ascending: false });
      break;
    case "ending":
      query = query.order("end_time", { ascending: true });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    default:
      query = query.order("is_trending", { ascending: false }).order("total_volume", {
        ascending: false,
      });
  }

  const { data, count } = await query.range(from, from + pageSize - 1);
  const total = count ?? 0;

  return {
    items: (data as unknown as Market[]) ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
  },
  ["list-markets"],
  { revalidate: 30, tags: [CACHE_TAGS.MARKETS] }
);

export const getMarketBySlug = cached(
  async (slug: string): Promise<Market | null> => {
    const supabase = createPublicClient();
    const { data } = await supabase.from("markets").select("*").eq("slug", slug).maybeSingle();
    return (data as Market) ?? null;
  },
  ["market-by-slug"],
  { revalidate: 15, tags: [CACHE_TAGS.MARKETS] }
);

export const getMarketOptions = cached(
  async (marketId: string): Promise<MarketOption[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("market_options")
      .select("*")
      .eq("market_id", marketId)
      .order("position", { ascending: true });
    return (data as MarketOption[]) ?? [];
  },
  ["market-options"],
  { revalidate: 15, tags: [CACHE_TAGS.MARKETS] }
);

/**
 * Odds snapshots for a market's price chart, oldest first. Capped so a very
 * heavily traded market can't return an unbounded series to the client; the
 * newest window is what the chart shows anyway.
 */
export const getMarketOddsHistory = cached(
  async (marketId: string): Promise<MarketOddsPoint[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("market_odds_history")
      .select("option_id,odds,recorded_at")
      .eq("market_id", marketId)
      .order("recorded_at", { ascending: false })
      .limit(500);
    return ((data as MarketOddsPoint[]) ?? []).reverse();
  },
  ["market-odds-history"],
  { revalidate: 15, tags: [CACHE_TAGS.MARKETS] }
);

/** Active ad slots keyed by placement, cached per request. */
export const getAdPlacements = cached(
  async (): Promise<Partial<Record<AdPlacementSlot, AdPlacementConfig>>> => {
    const supabase = createPublicClient();
    const { data } = await supabase.from("ad_placements").select("*").eq("is_active", true);

    const map: Partial<Record<AdPlacementSlot, AdPlacementConfig>> = {};
    for (const row of (data as AdPlacementConfig[]) ?? []) map[row.placement] = row;
    return map;
  },
  ["ad-placements"],
  { revalidate: 300, tags: [CACHE_TAGS.ADS] }
);

/**
 * Active tasks joined with the caller's latest submission per task, so the
 * earn page can show pending/approved state without a second round trip.
 */
export async function getEarnTasks(userId?: string): Promise<EarnTaskWithState[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: tasks } = await supabase
    .from("earn_tasks")
    .select("*")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  const rows = (tasks as EarnTask[]) ?? [];
  if (rows.length === 0 || !userId) {
    return rows.map((task) => ({ ...task, submission: null }));
  }

  const { data: subs } = await supabase
    .from("task_submissions")
    .select("id,task_id,status,reviewed_at,admin_note,created_at")
    .eq("user_id", userId)
    .in(
      "task_id",
      rows.map((task) => task.id)
    )
    .order("created_at", { ascending: false });

  const latest = new Map<string, EarnTaskWithState["submission"]>();
  for (const sub of (subs as (TaskSubmission & { task_id: string })[]) ?? []) {
    if (!latest.has(sub.task_id)) {
      latest.set(sub.task_id, {
        id: sub.id,
        status: sub.status,
        reviewed_at: sub.reviewed_at,
        admin_note: sub.admin_note,
      });
    }
  }

  return rows.map((task) => ({ ...task, submission: latest.get(task.id) ?? null }));
}

/** How many ad rewards the caller has claimed today (UTC). */
export async function getAdViewsToday(userId: string): Promise<number> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { count } = await supabase
    .from("ad_views")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("view_date", today);

  return count ?? 0;
}

export async function listTaskSubmissions(
  status: RequestStatus = "pending",
  page = 1,
  pageSize = DEFAULTS.PAGE_SIZE
): Promise<Paginated<TaskSubmissionWithRelations>> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;

  const { data, count, error } = await supabase
    .from("task_submissions")
    .select(
      // task_submissions points at profiles twice (user_id and reviewed_by), so
      // the embed has to name the constraint or PostgREST refuses it.
      "*,task:earn_tasks(id,title,type,target_url),user:profiles!task_submissions_user_id_fkey(id,email,username)",
      { count: "exact" }
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .range(from, from + pageSize - 1);

  if (error) throw error;

  const total = count ?? 0;
  return {
    items: (data as TaskSubmissionWithRelations[]) ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
