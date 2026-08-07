import Link from "next/link";
import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { CancelTradeButton } from "@/components/markets/cancel-trade-button";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, getSettings } from "@/lib/auth";
import { DEFAULTS } from "@/lib/constants";
import { cn, formatCurrency, toNumber } from "@/lib/utils";
import type { TradeWithMarket } from "@/types/database";

export const metadata: Metadata = { title: "My predictions" };

const TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function PredictionsPage({ searchParams }: PageProps) {
  const { status = "all", page: pageParam } = await searchParams;
  const profile = await requireProfile();
  const settings = await getSettings();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const from = (page - 1) * DEFAULTS.PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("trades")
    .select(
      "*,market:markets(id,slug,title,sport,team_a,team_b,status,end_time,resolved_outcome,yes_label,no_label),option:market_options(id,label,is_winner)",
      { count: "exact" }
    )
    .eq("user_id", profile.id);

  if (status !== "all") query = query.eq("status", status);

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + DEFAULTS.PAGE_SIZE - 1);

  const trades = (data as unknown as TradeWithMarket[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULTS.PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My predictions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total.toLocaleString()} position{total === 1 ? "" : "s"}. Open positions can be cancelled
          any time before the market resolves.
        </p>
      </header>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/dashboard/predictions" : `/dashboard/predictions?status=${tab.value}`}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              status === tab.value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {trades.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title={status === "all" ? "No predictions yet" : `No ${status} predictions`}
          description="Positions you open appear here with live payout estimates."
          actionLabel="Browse markets"
          actionHref="/markets"
        />
      ) : (
        <>
          <div className="space-y-3">
            {trades.map((trade) => {
              const profit =
                trade.status === "won"
                  ? toNumber(trade.payout) - toNumber(trade.amount)
                  : trade.status === "lost"
                    ? -toNumber(trade.amount)
                    : 0;

              return (
                <Card key={trade.id} className="glass">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/markets/${trade.market.slug}`}
                        className="truncate text-sm font-medium transition-colors hover:text-primary"
                      >
                        {trade.market.title}
                      </Link>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          {trade.option?.label ?? trade.side?.toUpperCase() ?? "—"}
                        </Badge>
                        <StatusBadge status={trade.status} className="px-1.5 py-0 text-[10px]" />
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {formatCurrency(trade.amount)} @ {Math.round(toNumber(trade.price) * 100)}¢ ·{" "}
                          {toNumber(trade.shares).toFixed(2)} shares · fee{" "}
                          {formatCurrency(trade.fee)}
                        </span>
                      </div>

                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(trade.created_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-right">
                        <p
                          className={cn(
                            "font-mono text-base font-semibold tabular-nums",
                            trade.status === "won" && "text-emerald-400",
                            trade.status === "lost" && "text-rose-400"
                          )}
                        >
                          {trade.status === "open"
                            ? formatCurrency(trade.potential_payout)
                            : formatCurrency(trade.payout)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {trade.status === "open"
                            ? "potential payout"
                            : profit !== 0
                              ? `${profit > 0 ? "+" : ""}${formatCurrency(profit)} P/L`
                              : "settled"}
                        </p>
                      </div>

                      {trade.status === "open" && (
                        <CancelTradeButton
                          tradeId={trade.id}
                          amount={trade.amount}
                          cancelFeeMin={settings.cancel_fee_min}
                          cancelFeeMax={settings.cancel_fee_max}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            baseHref={
              status === "all"
                ? "/dashboard/predictions"
                : `/dashboard/predictions?status=${status}`
            }
          />
        </>
      )}
    </div>
  );
}
