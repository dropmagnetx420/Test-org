import "server-only";
import { cache } from "react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { DEFAULTS } from "@/lib/constants";
import type {
  AdPlacementConfig,
  AdPlacementSlot,
  EarnTask,
  EarnTaskWithState,
  Market,
  MarketOption,
  Paginated,
  Partner,
  PromoBanner,
  RequestStatus,
  TaskSubmission,
  TaskSubmissionWithRelations,
} from "@/types/database";

const MARKET_LIST_COLUMNS =
  "id,slug,sport,league,title,team_a,team_b,yes_label,no_label,yes_odds,no_odds,total_volume,trade_count,status,is_featured,is_trending,start_time,end_time,resolved_outcome";

export const getLiveMarkets = cache(async (limit = 8): Promise<Market[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select("*")
    .eq("status", "open")
    .gt("end_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(limit);
  return (data as Market[]) ?? [];
});

export const getTrendingMarkets = cache(async (limit = 8): Promise<Market[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select("*")
    .eq("status", "open")
    .order("is_trending", { ascending: false })
    .order("total_volume", { ascending: false })
    .limit(limit);
  return (data as Market[]) ?? [];
});

export const getFeaturedMarkets = cache(async (limit = 4): Promise<Market[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select("*")
    .eq("status", "open")
    .eq("is_featured", true)
    .order("start_time", { ascending: true })
    .limit(limit);
  return (data as Market[]) ?? [];
});

export const getActiveBanners = cache(async (): Promise<PromoBanner[]> => {
  const supabase = await createClient();
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
});

export const getPartners = cache(async (): Promise<Partner[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partners")
    .select("*")
    .eq("is_active", true)
    .order("position", { ascending: true });
  return (data as Partner[]) ?? [];
});

export interface PublicStats {
  totalVolume: number;
  totalTrades: number;
  totalUsers: number;
  openMarkets: number;
  resolvedMarkets: number;
  sportCounts: Record<string, number>;
}

/**
 * Aggregate figures for the landing page. Uses the service-role client because
 * `profiles` is not readable by anonymous visitors — only counts are exposed.
 */
export const getPublicStats = cache(async (): Promise<PublicStats> => {
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

    const [marketRows, userCount, tradeCount] = await Promise.all([
      admin.from("markets").select("sport,status,total_volume,trade_count"),
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("trades").select("id", { count: "exact", head: true }),
    ]);

    const rows =
      (marketRows.data as { sport: string; status: string; total_volume: string; trade_count: number }[]) ??
      [];

    const stats = { ...empty, sportCounts: {} as Record<string, number> };
    for (const row of rows) {
      stats.totalVolume += Number(row.total_volume ?? 0);
      if (row.status === "open") {
        stats.openMarkets += 1;
        stats.sportCounts[row.sport] = (stats.sportCounts[row.sport] ?? 0) + 1;
      }
      if (row.status === "resolved") stats.resolvedMarkets += 1;
    }

    stats.totalUsers = userCount.count ?? 0;
    stats.totalTrades = tradeCount.count ?? 0;
    return stats;
  } catch {
    return empty;
  }
});

export interface MarketFilters {
  sport?: string;
  status?: string;
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export async function listMarkets(filters: MarketFilters = {}): Promise<Paginated<Market>> {
  const supabase = await createClient();
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
}

export async function getMarketBySlug(slug: string): Promise<Market | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("markets").select("*").eq("slug", slug).maybeSingle();
  return (data as Market) ?? null;
}

export async function getMarketOptions(marketId: string): Promise<MarketOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("market_options")
    .select("*")
    .eq("market_id", marketId)
    .order("position", { ascending: true });
  return (data as MarketOption[]) ?? [];
}

/** Active ad slots keyed by placement, cached per request. */
export const getAdPlacements = cache(
  async (): Promise<Partial<Record<AdPlacementSlot, AdPlacementConfig>>> => {
    const supabase = await createClient();
    const { data } = await supabase.from("ad_placements").select("*").eq("is_active", true);

    const map: Partial<Record<AdPlacementSlot, AdPlacementConfig>> = {};
    for (const row of (data as AdPlacementConfig[]) ?? []) map[row.placement] = row;
    return map;
  }
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

  const { data, count } = await supabase
    .from("task_submissions")
    .select(
      "*,task:earn_tasks(id,title,type,target_url),user:profiles(id,email,username)",
      { count: "exact" }
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .range(from, from + pageSize - 1);

  const total = count ?? 0;
  return {
    items: (data as TaskSubmissionWithRelations[]) ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
