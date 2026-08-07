import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Gift,
  Percent,
  Receipt,
  RotateCcw,
  Settings2,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { DEFAULTS } from "@/lib/constants";
import { cn, formatCurrency, toNumber } from "@/lib/utils";
import type { Transaction, TransactionType } from "@/types/database";

export const metadata: Metadata = { title: "Transactions" };

const TYPE_META: Record<TransactionType, { label: string; icon: typeof Receipt; tone: string }> = {
  deposit: { label: "Deposit", icon: ArrowDownToLine, tone: "text-emerald-400" },
  withdrawal: { label: "Withdrawal", icon: ArrowUpFromLine, tone: "text-rose-400" },
  trade_buy: { label: "Prediction", icon: TrendingUp, tone: "text-violet-400" },
  trade_cancel: { label: "Trade cancelled", icon: RotateCcw, tone: "text-amber-400" },
  trade_payout: { label: "Payout", icon: Trophy, tone: "text-emerald-400" },
  trade_refund: { label: "Refund", icon: RotateCcw, tone: "text-cyan-400" },
  fee: { label: "Fee", icon: Percent, tone: "text-muted-foreground" },
  bonus: { label: "Bonus", icon: Gift, tone: "text-cyan-400" },
  referral: { label: "Referral commission", icon: Users, tone: "text-emerald-400" },
  admin_adjustment: { label: "Adjustment", icon: Settings2, tone: "text-amber-400" },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "deposit", label: "Deposits" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "trade_buy", label: "Predictions" },
  { value: "trade_payout", label: "Payouts" },
  { value: "bonus", label: "Bonuses" },
  { value: "referral", label: "Referrals" },
  { value: "fee", label: "Fees" },
];

interface PageProps {
  searchParams: Promise<{ type?: string; page?: string }>;
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const { type = "all", page: pageParam } = await searchParams;
  const profile = await requireProfile();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const from = (page - 1) * DEFAULTS.PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("user_id", profile.id);

  if (type !== "all") query = query.eq("type", type);

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + DEFAULTS.PAGE_SIZE - 1);

  const transactions = (data as Transaction[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULTS.PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every balance movement on your account, newest first.
        </p>
      </header>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={
              filter.value === "all"
                ? "/dashboard/transactions"
                : `/dashboard/transactions?type=${filter.value}`
            }
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              type === filter.value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
            )}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Deposits, trades, payouts and bonuses all show up in this ledger."
          actionLabel="Make a deposit"
          actionHref="/wallet/deposit"
        />
      ) : (
        <>
          <Card className="glass overflow-hidden">
            <CardContent className="p-0">
              <ul className="divide-y divide-border/60">
                {transactions.map((tx) => {
                  const meta = TYPE_META[tx.type] ?? {
                    label: tx.type,
                    icon: Receipt,
                    tone: "text-muted-foreground",
                  };
                  const amount = toNumber(tx.amount);
                  const Icon = meta.icon;

                  return (
                    <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
                      <div
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-lg bg-secondary/60",
                          meta.tone
                        )}
                      >
                        <Icon className="size-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {meta.label}
                          {tx.is_bonus && (
                            <span className="ml-1.5 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-medium text-cyan-400">
                              bonus
                            </span>
                          )}
                        </p>
                        {tx.description && (
                          <p className="truncate text-xs text-muted-foreground">{tx.description}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "font-mono text-sm font-semibold tabular-nums",
                            amount >= 0 ? "text-emerald-400" : "text-rose-400"
                          )}
                        >
                          {amount >= 0 ? "+" : ""}
                          {formatCurrency(amount)}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
                          bal {formatCurrency(tx.balance_after)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Pagination
            page={page}
            totalPages={totalPages}
            baseHref={
              type === "all" ? "/dashboard/transactions" : `/dashboard/transactions?type=${type}`
            }
          />
        </>
      )}
    </div>
  );
}
