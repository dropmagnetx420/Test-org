import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { WithdrawForm } from "@/components/wallet/withdraw-form";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireProfile } from "@/lib/auth";
import type { Wallet } from "@/types/database";

export const metadata: Metadata = { title: "Withdraw" };

export default async function WithdrawPage() {
  const profile = await requireProfile();
  const settings = await getSettings();

  const supabase = await createClient();
  const { data } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", profile.id)
    .single();

  const wallet = data as Wallet | null;

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
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Withdraw funds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send your available balance to an external wallet.
        </p>
      </header>

      <WithdrawForm
        available={wallet?.available_balance ?? "0"}
        bonus={wallet?.bonus_balance ?? "0"}
        turnoverRequired={wallet?.bonus_turnover_required ?? "0"}
        turnoverCompleted={wallet?.bonus_turnover_completed ?? "0"}
        minWithdrawal={settings.min_withdrawal}
        feePercent={settings.withdrawal_fee_percent}
        kycRequired={settings.kyc_required_for_withdrawal}
        kycStatus={profile.kyc_status}
      />
    </div>
  );
}
