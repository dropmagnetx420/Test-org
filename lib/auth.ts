import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createClient,
  createAdminClient,
  createPublicClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { Profile, Wallet, SiteSettings } from "@/types/database";
import { CACHE_TAGS, RATE_LIMITS } from "@/lib/constants";

/**
 * Sensible defaults so the public site renders when the Supabase integration
 * is not connected. Admin-managed values fall back to launch-time settings.
 */
const FALLBACK_SETTINGS: SiteSettings = {
  id: 1,
  site_name: "NextGen Predict",
  site_tagline: "Predict. Trade. Win.",
  logo_url: null,
  support_email: null,
  twitter_url: null,
  telegram_url: null,
  discord_url: null,
  trade_fee_percent: "2",
  trade_fee_min: "1",
  trade_fee_max: "50",
  cancel_fee_min: "1",
  cancel_fee_max: "25",
  min_deposit: "100",
  min_withdrawal: "200",
  withdrawal_fee_percent: "2",
  welcome_bonus: "50",
  deposit_bonus_percent: "0",
  first_deposit_bonus_percent: "10",
  first_deposit_bonus_max: "500",
  bonus_turnover_multiplier: "3",
  referral_commission_percent: "5",
  kyc_required_for_withdrawal: true,
  maintenance_mode: false,
  registration_enabled: true,
  ads_enabled: true,
  ad_reward: "1",
  ad_watch_seconds: 15,
  ad_daily_limit: 10,
  earn_tasks_enabled: true,
  task_reward_is_bonus: true,
  updated_at: new Date(0).toISOString(),
};

export const getUser = cache(async () => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
});

export const getWallet = cache(async (): Promise<Wallet | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("wallets").select("*").eq("user_id", user.id).single();
  return (data as Wallet) ?? null;
});

/**
 * Every layout, the footer and each ad slot read this, so an uncached lookup
 * cost four to five identical round trips per page. `site_settings` is world
 * readable, so the anonymous client is enough and keeps the call out of the
 * per-request cookie scope. `cache` collapses repeat calls inside one render;
 * `unstable_cache` keeps it off the wire between renders.
 */
export const getSettings = cache(
  unstable_cache(
    async (): Promise<SiteSettings> => {
      if (!isSupabaseConfigured) return FALLBACK_SETTINGS;
      const supabase = createPublicClient();
      const { data } = await supabase.from("site_settings").select("*").eq("id", 1).single();
      return (data as SiteSettings) ?? FALLBACK_SETTINGS;
    },
    ["site-settings"],
    { revalidate: 300, tags: [CACHE_TAGS.SETTINGS] }
  )
);

/** Redirects to /login when unauthenticated. Use in protected pages. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** Returns the profile, or redirects. Blocks banned accounts. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status === "banned") redirect("/banned");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "super_admin") redirect("/dashboard");
  return profile;
}

export async function requireSuperAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") redirect("/admin");
  return profile;
}

export function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

/** Best-effort client IP for rate limiting and audit logs. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function getUserAgent(): Promise<string> {
  const h = await headers();
  return (h.get("user-agent") ?? "unknown").slice(0, 300);
}

type RateBucket = keyof typeof RATE_LIMITS;

/**
 * Database-backed sliding-window rate limit. Fails open when the DB is
 * unreachable so a transient outage cannot lock every user out.
 */
export async function rateLimit(bucket: RateBucket, identifier?: string): Promise<boolean> {
  const { limit, windowMs } = RATE_LIMITS[bucket];
  const key = identifier ?? (await getClientIp());

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_bucket: bucket,
      p_limit: limit,
      p_window_ms: windowMs,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

export async function logAdminAction(params: {
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
}) {
  const user = await getUser();
  if (!user) return;

  try {
    const admin = createAdminClient();
    await admin.from("admin_logs").insert({
      admin_id: user.id,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      before_data: params.beforeData ?? null,
      after_data: params.afterData ?? null,
      ip_address: await getClientIp(),
      user_agent: await getUserAgent(),
    });
  } catch {
    // Audit logging must never block the primary action.
  }
}
