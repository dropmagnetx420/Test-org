import { Suspense } from "react";
import { getProfile, getSettings, isAdminRole } from "@/lib/auth";
import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { AdSlot } from "@/components/shared/ad-slot";
import { PromoBar } from "@/components/shared/promo-bar";
import { MaintenanceNotice } from "@/components/shared/maintenance-notice";
import {
  HeaderAccount,
  HeaderAccountFallback,
  HeaderMobileAuth,
} from "@/components/shared/header-account";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Only `settings` is awaited here: it is a single-row lookup and the
  // maintenance gate decides whether `children` renders at all. The auth
  // round trip stays off the critical path unless the gate is actually armed.
  const settings = await getSettings();

  if (settings.maintenance_mode && !isAdminRole((await getProfile())?.role)) {
    return <MaintenanceNotice settings={settings} />;
  }

  return (
    <>
      <SiteHeader
        siteName={settings.site_name}
        logoUrl={settings.logo_url}
        account={
          <Suspense fallback={<HeaderAccountFallback />}>
            <HeaderAccount />
          </Suspense>
        }
        mobileAuth={
          <Suspense fallback={null}>
            <HeaderMobileAuth />
          </Suspense>
        }
      />
      <Suspense fallback={null}>
        <PromoBar className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8" />
      </Suspense>
      <AdSlot placement="header" className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8" />
      <main className="flex-1">{children}</main>
      <AdSlot placement="footer" className="mx-auto mb-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8" />
      <SiteFooter settings={settings} />
    </>
  );
}
