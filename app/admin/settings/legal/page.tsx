import type { Metadata } from "next";
import { SettingsNav } from "@/components/admin/settings-nav";
import { LegalPagesForm } from "@/components/admin/legal-form";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { LegalPage } from "@/types/database";

export const metadata: Metadata = { title: "Legal pages · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminLegalPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.from("legal_pages").select("*").order("slug");
  const pages = (data as LegalPage[]) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Legal pages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the Terms of Service and Privacy Policy your members see. Written in Markdown and
          published the moment you save.
        </p>
      </header>

      <SettingsNav active="/admin/settings/legal" />
      <LegalPagesForm pages={pages} />
    </div>
  );
}
