import type { Metadata } from "next";
import { SettingsNav } from "@/components/admin/settings-nav";
import { SettingsForm } from "@/components/admin/settings-form";
import { getSettings, requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Site settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fees, limits, and bonuses apply to every new trade and request from the moment you save.
        </p>
      </header>

      <SettingsNav active="/admin/settings" />
      <SettingsForm settings={settings} />
    </div>
  );
}
