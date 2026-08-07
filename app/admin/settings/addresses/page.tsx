import type { Metadata } from "next";
import { SettingsNav } from "@/components/admin/settings-nav";
import { AddressManager } from "@/components/admin/address-manager";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { DepositAddress } from "@/types/database";

export const metadata: Metadata = { title: "Deposit addresses · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminAddressesPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("deposit_addresses")
    .select("*")
    .order("network")
    .order("asset")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Deposit addresses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The deposit page shows a random active address for the chosen network and asset.
        </p>
      </header>

      <SettingsNav active="/admin/settings/addresses" />
      <AddressManager addresses={(data as DepositAddress[]) ?? []} />
    </div>
  );
}
