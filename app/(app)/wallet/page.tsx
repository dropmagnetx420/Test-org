import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Gift,
  Lock,
  Sparkles,
  Wallet as WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { NETWORKS } from "@/lib/constants";
import { cn, formatCurrency, toNumber, truncateAddress } from "@/lib/utils";
import type { DepositRequest, WithdrawRequest, Wallet } from "@/types/database";

export const metadata: Metadata = { title: "Wallet" };

function networkLabel(value: string) {
  return NETWORKS.find((item) => item.value === value)?.label ?? value;
}

export default async function WalletPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: walletRow }, { data: depositRows }, { data: withdrawRows }] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", profile.id).single(),
    supabase
      .from("deposit_requests")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("withdraw_requests")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const wallet = walletRow as Wallet | null;
  const deposits = (depositRows as DepositRequest[]) ?? [];
  const withdrawals = (withdrawRows as WithdrawRequest[]) ?? [];

  const available = toNumber(wallet?.available_balance);
  const bonus = toNumber(wallet?.bonus_balance);
  const locked = toNumber(wallet?.locked_balance);
  const required = toNumber(wallet?.bonus_turnover_required);
  const completed = toNumber(wallet?.bonus_turnover_completed);
  const turnoverPct = required > 0 ? Math.min(100, (completed / required) * 100) : 100;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Wallet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fund your account, withdraw winnings and track every request.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="gradient">
            <Link href="/wallet/deposit">
              <ArrowDownToLine className="size-4" />
              Deposit
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/wallet/withdraw">
              <ArrowUpFromLine className="size-4" />
              Withdraw
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Available balance"
          numericValue={available}
          kind="currency"
          suffix=" USDG"
          icon={WalletIcon}
          accent="primary"
        />
        <StatCard
          label="Bonus balance"
          numericValue={bonus}
          kind="currency"
          suffix=" USDG"
          icon={Gift}
          accent="accent"
          hint={required > 0 ? `${formatCurrency(completed)} / ${formatCurrency(required)} turnover` : undefined}
        />
        <StatCard
          label="In open predictions"
          numericValue={locked}
          kind="currency"
          suffix=" USDG"
          icon={Lock}
          accent="warning"
        />
        <StatCard
          label="Lifetime deposited"
          numericValue={toNumber(wallet?.total_deposited ?? 0)}
          kind="currency"
          suffix=" USDG"
          icon={Sparkles}
          accent="success"
          hint={`${formatCurrency(wallet?.total_withdrawn ?? 0)} withdrawn`}
        />
      </div>

      {required > 0 && completed < required && (
        <Card className="glass border-cyan-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Bonus turnover progress</CardTitle>
            <CardDescription>
              Trade {formatCurrency(Math.max(0, required - completed))} USDG more to unlock your
              bonus balance for withdrawal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-primary transition-all"
                style={{ width: `${turnoverPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {turnoverPct.toFixed(0)}% complete — {formatCurrency(completed)} of{" "}
              {formatCurrency(required)} USDG traded.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Deposit history</CardTitle>
              <CardDescription>Your 8 most recent requests.</CardDescription>
            </div>
            <ArrowDownToLine className="size-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-0">
            {deposits.length === 0 ? (
              <div className="px-6 pb-6">
                <EmptyState
                  icon={ArrowDownToLine}
                  title="No deposits yet"
                  description="Add funds to start predicting."
                  actionLabel="Make a deposit"
                  actionHref="/wallet/deposit"
                />
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {deposits.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {formatCurrency(item.amount)} {item.asset}
                        {toNumber(item.bonus_applied) > 0 && (
                          <span className="ml-1.5 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-medium text-cyan-400">
                            +{formatCurrency(item.bonus_applied)} bonus
                          </span>
                        )}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {networkLabel(item.network)} · {truncateAddress(item.tx_hash, 10, 6)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      {item.admin_note && (
                        <p className="mt-1 text-[11px] text-amber-300">{item.admin_note}</p>
                      )}
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Withdrawal history</CardTitle>
              <CardDescription>Your 8 most recent requests.</CardDescription>
            </div>
            <ArrowUpFromLine className="size-4 text-rose-400" />
          </CardHeader>
          <CardContent className="p-0">
            {withdrawals.length === 0 ? (
              <div className="px-6 pb-6">
                <EmptyState
                  icon={ArrowUpFromLine}
                  title="No withdrawals yet"
                  description="Cash out winnings once you're ready."
                  actionLabel="Request withdrawal"
                  actionHref="/wallet/withdraw"
                />
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {withdrawals.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {formatCurrency(item.amount)} {item.asset}
                        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                          net {formatCurrency(item.net_amount)}
                        </span>
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {networkLabel(item.network)} · {truncateAddress(item.wallet_address, 10, 6)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      {item.tx_hash && (
                        <p className={cn("mt-1 truncate font-mono text-[11px] text-emerald-400")}>
                          tx {truncateAddress(item.tx_hash, 10, 6)}
                        </p>
                      )}
                      {item.admin_note && (
                        <p className="mt-1 text-[11px] text-amber-300">{item.admin_note}</p>
                      )}
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
