import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser, getProfile, getSettings, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/shared/site-header";
import { HeaderAccount } from "@/components/shared/header-account";
import { SiteFooter } from "@/components/shared/site-footer";
import { MaintenanceNotice } from "@/components/shared/maintenance-notice";
import { AdSlot } from "@/components/shared/ad-slot";
import { PromoBar } from "@/components/shared/promo-bar";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  /**
   * `requireUser` resolves the session first because the badge count needs the
   * id. Everything after it is independent, so the profile, settings and count
   * go out together rather than as three sequential round trips.
   */
  const user = await requireUser();
  const supabase = await createClient();

  const [profile, settings, unread] = await Promise.all([
    getProfile(),
    getSettings(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false),
  ]);

  if (!profile) redirect("/login");
  if (profile.status === "banned") redirect("/banned");

  if (settings.maintenance_mode && !isAdminRole(profile.role)) {
    return <MaintenanceNotice settings={settings} />;
  }

  const count = unread.count;

  return (
    <>
      <SiteHeader siteName={settings.site_name} account={<HeaderAccount />} />
      <Suspense fallback={null}>
        <PromoBar className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8" />
      </Suspense>
      <AdSlot placement="header" className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8" />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex flex-col gap-6 lg:w-56 lg:shrink-0">
            <DashboardNav unreadCount={count ?? 0} />
            <AdSlot placement="sidebar" className="hidden lg:block" />
          </div>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>

      <AdSlot placement="footer" className="mx-auto mb-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8" />
      <SiteFooter settings={settings} />
    </>
  );
}
