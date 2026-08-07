"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { ok, fail, toActionError } from "@/lib/action-utils";
import type { ActionResult } from "@/types/database";

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return toActionError(error);

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  return ok();
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_all_notifications_read");

  if (error) return toActionError(error);

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  return ok(null, "All notifications marked as read.");
}

export async function claimPromo(bannerId: string): Promise<ActionResult<{ amount: number }>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to claim this offer.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_promo", { p_banner_id: bannerId });

  if (error) return toActionError(error);

  revalidatePath("/");
  revalidatePath("/wallet");
  revalidatePath("/dashboard");

  const amount = Number(data ?? 0);
  return ok({ amount }, amount > 0 ? `${amount} USDG bonus credited.` : "Offer claimed.");
}
