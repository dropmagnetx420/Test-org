import type { Metadata } from "next";
import { SettingsNav } from "@/components/admin/settings-nav";
import { PartnerManager } from "@/components/admin/partner-manager";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Partner } from "@/types/database";

export const metadata: Metadata = { title: "Partners · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPartnersPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.from("partners").select("*").order("position").order("name");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Partners</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Partner logos displayed on the landing page.
        </p>
      </header>

      <SettingsNav active="/admin/settings/partners" />
      <PartnerManager partners={(data as Partner[]) ?? []} />
    </div>
  );
}
