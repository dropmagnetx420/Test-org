import { requireProfile, getWallet, getSettings, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { MaintenanceNotice } from "@/components/shared/maintenance-notice";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const [wallet, settings] = await Promise.all([getWallet(), getSettings()]);

  if (settings.maintenance_mode && !isAdminRole(profile.role)) {
    return <MaintenanceNotice settings={settings} />;
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_read", false);

  return (
    <>
      <SiteHeader profile={profile} wallet={wallet} />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <DashboardNav unreadCount={count ?? 0} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>

      <SiteFooter settings={settings} />
    </>
  );
}
