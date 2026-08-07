import type { Metadata } from "next";
import { SettingsNav } from "@/components/admin/settings-nav";
import { AdManager } from "@/components/admin/ad-manager";
import { getAdPlacements } from "@/lib/queries";
import { getSettings, requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Ad placements · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminAdsPage() {
  await requireAdmin();

  const [placements, settings] = await Promise.all([getAdPlacements(), getSettings()]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ad placements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a provider per slot and paste its unit ID. Only enabled slots render.
        </p>
      </header>

      <SettingsNav active="/admin/settings/ads" />

      {!settings.ads_enabled && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          Ads are switched off globally. Turn on <span className="font-medium">Ads enabled</span> in
          General settings before these slots render.
        </div>
      )}

      <AdManager placements={placements} />
    </div>
  );
}
