import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { OWNER_EMAIL } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * One-time bootstrap for the first super_admin. New profiles default to
 * role='user', and every admin surface requires an existing admin, so the
 * first promotion cannot come from inside the app.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.ADMIN_SETUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ADMIN_SETUP_SECRET is not configured" }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({ role: "super_admin", status: "active", ban_reason: null })
    .eq("email", OWNER_EMAIL)
    .select("id, email, role")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: `No profile for ${OWNER_EMAIL}. Sign up with that email first, then retry.` },
      { status: 404 }
    );
  }

  // guard_profile_update() reverts the role for non-admin callers and still
  // reports success, so an unmigrated database looks like a clean promotion.
  if (data.role !== "super_admin") {
    return NextResponse.json(
      { error: "Database reverted the role. Apply pending migrations, then retry." },
      { status: 500 }
    );
  }

  revalidatePath("/admin");

  return NextResponse.json({ promoted: data });
}
