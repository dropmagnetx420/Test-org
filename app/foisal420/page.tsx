import { notFound, redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { OWNER_EMAIL } from "@/lib/constants";
import { PromoteOwnerButton } from "@/components/admin/promote-owner-button";

export const dynamic = "force-dynamic";

/**
 * Owner bootstrap. New profiles default to role='user', and every admin surface
 * requires an existing admin, so the first promotion cannot come from inside
 * the app. Anything other than the owner 404s so the path stays unadvertised.
 */
export default async function Foisal420Page() {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/foisal420")}`);

  const email = user.email?.toLowerCase();
  if (email !== OWNER_EMAIL.toLowerCase() || !user.email_confirmed_at) notFound();

  const profile = await getProfile();
  if (profile?.role === "super_admin") redirect("/admin");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
        <h1 className="text-lg font-semibold">Owner bootstrap</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Grant super admin to {user.email}. This is a one-time step for the first admin account.
        </p>
        <div className="mt-5">
          <PromoteOwnerButton />
        </div>
      </div>
    </div>
  );
}
