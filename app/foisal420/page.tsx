import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { OWNER_EMAIL } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Owner bootstrap. New profiles default to role='user', and every admin surface
 * requires an existing admin, so the first promotion cannot come from inside
 * the app. Visiting this path as the verified owner grants super_admin.
 *
 * Anything other than the owner 404s so the path stays unadvertised.
 */
export default async function Foisal420Page() {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/foisal420")}`);

  const email = user.email?.toLowerCase();
  if (email !== OWNER_EMAIL.toLowerCase() || !user.email_confirmed_at) notFound();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: "super_admin", status: "active", ban_reason: null })
    .eq("id", user.id);

  if (error) throw new Error(`Could not grant admin access: ${error.message}`);

  revalidatePath("/", "layout");
  redirect("/admin");
}
