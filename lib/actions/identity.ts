"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { ok, fail } from "@/lib/action-utils";
import type { ActionResult } from "@/types/database";

async function siteOrigin() {
  const h = await headers();
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Begins linking a Google identity to the signed-in account. Returns an OAuth
 * URL for the browser to visit; on return the shared /auth/callback exchanges
 * the code and Supabase attaches the identity to the current user. Requires
 * Auth → "Manual Linking" to be enabled in the Supabase dashboard.
 */
export async function linkGoogle(): Promise<ActionResult<{ url: string }>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(
        "/profile?linked=google"
      )}`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error) return fail(error.message || "Could not start Google linking.");
  if (!data?.url) return fail("Could not start Google linking.");
  return ok({ url: data.url });
}

/**
 * Removes one login method from the caller's account. The identity is looked up
 * server-side among the caller's *own* identities, so a client can only ever
 * unlink something it already owns. Refuses to remove the last method, which
 * would lock the account out entirely.
 */
export async function unlinkLoginMethod(identityId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");
  if (!identityId) return fail("Choose a login method to remove.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error || !data) return fail("Could not load your login methods.");

  const identities = data.identities ?? [];
  if (identities.length <= 1) {
    return fail("This is your only login method — add another before removing it.");
  }

  const target = identities.find((i) => i.identity_id === identityId);
  if (!target) return fail("That login method was not found on your account.");

  const { error: unlinkError } = await supabase.auth.unlinkIdentity(target);
  if (unlinkError) return fail(unlinkError.message || "Could not remove that login method.");

  revalidatePath("/profile");
  return ok(null, "Login method removed.");
}

/**
 * Best-effort backfill of the profile from a linked Google identity — only
 * fills columns that are still blank (the typical wallet-only signup). Uses the
 * admin client because `guard_profile_update()` reverts a self-service email
 * change; the service role is the sanctioned path for it.
 */
export async function syncIdentityToProfile(): Promise<void> {
  const user = await getUser();
  if (!user) return;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUserIdentities();
  const google = data?.identities?.find((i) => i.provider === "google");
  if (!google) return;

  const idata = google.identity_data ?? {};
  const pick = (k: string) => (typeof idata[k] === "string" ? (idata[k] as string) : null);
  const email = pick("email")?.toLowerCase() ?? null;
  const fullName = pick("full_name") ?? pick("name");
  const avatar = pick("avatar_url") ?? pick("picture");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, avatar_url")
    .eq("id", user.id)
    .single();
  if (!profile) return;

  const patch: Record<string, string> = {};
  if (!profile.email && email) patch.email = email;
  if (!profile.full_name && fullName) patch.full_name = fullName;
  if (!profile.avatar_url && avatar) patch.avatar_url = avatar;
  if (Object.keys(patch).length === 0) return;

  // Ignore a unique-email clash: the backfill is a convenience, not a guarantee.
  const admin = createAdminClient();
  await admin.from("profiles").update(patch).eq("id", user.id);

  revalidatePath("/profile");
  revalidatePath("/dashboard");
}
