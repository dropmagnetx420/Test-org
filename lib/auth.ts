import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Profile, Wallet, SiteSettings } from "@/types/database";
import { RATE_LIMITS } from "@/lib/constants";

export const getUser = cache(async () => {
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

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("*").eq("id", 1).single();
  return data as SiteSettings;
});

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
