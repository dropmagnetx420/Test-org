import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { DepositForm } from "@/components/wallet/deposit-form";
import { getSettings, requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Deposit" };

export default async function DepositPage() {
  await requireProfile();
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/wallet"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to wallet
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Deposit funds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Transfer crypto to your assigned address, then submit the transaction hash for review.
        </p>
      </header>

      <DepositForm
        minDeposit={settings.min_deposit}
        bonusPercent={settings.deposit_bonus_percent}
      />
    </div>
  );
}
