import type { Metadata } from "next";
import { SettingsNav } from "@/components/admin/settings-nav";
import { CampaignManager } from "@/components/admin/campaign-manager";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Campaign } from "@/types/database";

export const metadata: Metadata = { title: "Campaigns · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .order("starts_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Campaigns</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Time-boxed leaderboard competitions. The live one shows on the public leaderboard; winners
          are recorded here and paid with the balance tools.
        </p>
      </header>

      <SettingsNav active="/admin/settings/campaigns" />
      <CampaignManager campaigns={(data as Campaign[]) ?? []} />
    </div>
  );
}
