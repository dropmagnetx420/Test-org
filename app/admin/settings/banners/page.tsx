import type { Metadata } from "next";
import { SettingsNav } from "@/components/admin/settings-nav";
import { BannerManager } from "@/components/admin/banner-manager";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { PromoBanner } from "@/types/database";

export const metadata: Metadata = { title: "Promo banners · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminBannersPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("promo_banners")
    .select("*")
    .order("position")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Promo banners</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Campaign banners shown on the landing page, with an optional bonus and claim cap.
        </p>
      </header>

      <SettingsNav active="/admin/settings/banners" />
      <BannerManager banners={(data as PromoBanner[]) ?? []} />
    </div>
  );
}
