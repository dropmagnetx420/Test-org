import { getProfile, getWallet, getSettings, isAdminRole } from "@/lib/auth";
import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { AdSlot } from "@/components/shared/ad-slot";
import { MaintenanceNotice } from "@/components/shared/maintenance-notice";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [profile, wallet, settings] = await Promise.all([getProfile(), getWallet(), getSettings()]);

  if (settings.maintenance_mode && !isAdminRole(profile?.role)) {
    return <MaintenanceNotice settings={settings} />;
  }

  return (
    <>
      <SiteHeader
        profile={profile}
        wallet={wallet}
        siteName={settings.site_name}
        logoUrl={settings.logo_url}
      />
      <AdSlot placement="header" className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8" />
      <main className="flex-1">{children}</main>
      <AdSlot placement="footer" className="mx-auto mb-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8" />
      <SiteFooter settings={settings} />
    </>
  );
}
