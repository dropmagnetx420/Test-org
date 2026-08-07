import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarClock, Info, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { Countdown } from "@/components/shared/countdown";
import { TradePanel } from "@/components/markets/trade-panel";
import { CancelTradeButton } from "@/components/markets/cancel-trade-button";
import { EmptyState } from "@/components/shared/empty-state";
import { AdSlot } from "@/components/shared/ad-slot";
import { createClient } from "@/lib/supabase/server";
import { getUser, getWallet, getSettings } from "@/lib/auth";
import { getMarketBySlug, getMarketOptions } from "@/lib/queries";
import { SPORTS } from "@/lib/constants";
import { cn, formatCurrency, formatCompact, toNumber } from "@/lib/utils";
import type { Trade } from "@/types/database";

export const revalidate = 15;

const OUTCOME_BARS = [
  "bg-gradient-to-r from-emerald-500 to-teal-400",
  "bg-gradient-to-r from-rose-500 to-red-400",
  "bg-gradient-to-r from-violet-500 to-purple-400",
  "bg-gradient-to-r from-amber-500 to-orange-400",
  "bg-gradient-to-r from-sky-500 to-cyan-400",
  "bg-gradient-to-r from-pink-500 to-fuchsia-400",
  "bg-gradient-to-r from-lime-500 to-green-400",
  "bg-gradient-to-r from-slate-500 to-zinc-400",
];

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const market = await getMarketBySlug(slug);
  if (!market) return { title: "Market not found" };

  return {
    title: market.title,
    description:
      market.description ??
      `Trade ${market.yes_label} or ${market.no_label} on ${market.title} at NextGen Predict.`,
    openGraph: { title: market.title, description: market.description ?? undefined },
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function MarketDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const market = await getMarketBySlug(slug);
  if (!market) notFound();

  const [user, wallet, settings, options] = await Promise.all([
    getUser(),
    getWallet(),
    getSettings(),
    getMarketOptions(market.id),
  ]);

  let myTrades: Trade[] = [];
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("trades")
      .select("*")
      .eq("market_id", market.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25);
    myTrades = (data as Trade[]) ?? [];
  }

  const meta = SPORTS.find((s) => s.value === market.sport) ?? SPORTS[0];
  const optionLabels = new Map(options.map((option) => [option.id, option.label]));
  const winner = options.find((option) => option.is_winner);
  const leader = options.reduce<(typeof options)[number] | undefined>(
    (best, option) => (!best || toNumber(option.odds) > toNumber(best.odds) ? option : best),
    undefined
  );
  const leaderPct = Math.round(toNumber(leader?.odds) * 100);
  const openPositions = myTrades.filter((t) => t.status === "open");
  const invested = openPositions.reduce((sum, t) => sum + toNumber(t.amount), 0);
  const potential = openPositions.reduce((sum, t) => sum + toNumber(t.potential_payout), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/markets" className="transition-colors hover:text-foreground">
          Markets
        </Link>
        <span>/</span>
        <Link
          href={`/markets?sport=${market.sport}`}
          className="transition-colors hover:text-foreground"
        >
          {meta.label}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r px-3 py-1 text-xs font-medium",
                  meta.gradient
                )}
              >
                {meta.icon} {meta.label}
              </span>
              {market.league && <Badge variant="outline">{market.league}</Badge>}
              <StatusBadge status={market.status} />
              {market.is_trending && <Badge variant="warning">Trending</Badge>}
            </div>

            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
              {market.title}
            </h1>

            {market.team_a && market.team_b && (
              <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                <span className="text-foreground">{market.team_a}</span>
                <span className="text-xs uppercase tracking-widest">vs</span>
                <span className="text-foreground">{market.team_b}</span>
              </div>
            )}
          </header>

          <div className="glass overflow-hidden rounded-xl p-5">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Implied probability
                </p>
                <p className="font-mono text-4xl font-bold tabular-nums text-emerald-400">
                  {leaderPct}%
                </p>
                <p className="text-xs text-muted-foreground">chance of {leader?.label ?? "—"}</p>
              </div>
              <Countdown to={market.end_time} className="text-sm" />
            </div>

            <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary">
              {options.map((option, index) => (
                <div
                  key={option.id}
                  className={cn("h-full", OUTCOME_BARS[index % OUTCOME_BARS.length])}
                  style={{ width: `${Math.round(toNumber(option.odds) * 100)}%` }}
                />
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {options.map((option) => (
                <div
                  key={option.id}
                  className={cn(
                    "rounded-lg border p-3",
                    option.is_winner
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-border/60 bg-card/50"
                  )}
                >
                  <p className="truncate text-xs font-medium">{option.label}</p>
                  <p className="font-mono text-2xl font-semibold tabular-nums">
                    {Math.round(toNumber(option.odds) * 100)}¢
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatCompact(option.volume)} USDG volume
                  </p>
                </div>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                icon: BarChart3,
                label: "Total volume",
                value: `${formatCompact(market.total_volume)} USDG`,
              },
              { icon: Users, label: "Predictions", value: market.trade_count.toLocaleString() },
              { icon: CalendarClock, label: "Starts", value: formatDate(market.start_time) },
              { icon: CalendarClock, label: "Closes", value: formatDate(market.end_time) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-lg border border-border/60 bg-card/50 p-3">
                <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Icon className="size-3" />
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          {market.status === "resolved" && (
            <Card className="border-cyan-500/30 bg-cyan-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="size-4 text-cyan-400" />
                  Resolved: {winner?.label ?? "settled"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {market.resolution_note && <p>{market.resolution_note}</p>}
                {market.resolved_at && <p className="text-xs">Settled {formatDate(market.resolved_at)}</p>}
              </CardContent>
            </Card>
          )}

          {(market.description || market.rules) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="size-4" />
                  About this market
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                {market.description && <p className="whitespace-pre-line">{market.description}</p>}
                {market.rules && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-1 font-medium text-foreground">Resolution rules</p>
                      <p className="whitespace-pre-line">{market.rules}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your positions</CardTitle>
            </CardHeader>
            <CardContent>
              {!user ? (
                <EmptyState
                  title="Sign in to see your positions"
                  description="Your open and settled predictions for this market appear here."
                  actionLabel="Sign in"
                  actionHref={`/login?next=/markets/${market.slug}`}
                  className="border-0 py-8"
                />
              ) : myTrades.length === 0 ? (
                <EmptyState
                  title="No positions yet"
                  description="Place your first prediction on this market using the panel on the right."
                  className="border-0 py-8"
                />
              ) : (
                <div className="space-y-3">
                  {openPositions.length > 0 && (
                    <div className="flex flex-wrap gap-4 rounded-lg bg-secondary/40 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">
                        Invested{" "}
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {formatCurrency(invested)}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Potential payout{" "}
                        <span className="font-mono font-medium text-emerald-400 tabular-nums">
                          {formatCurrency(potential)}
                        </span>
                      </span>
                    </div>
                  )}

                  <ul className="divide-y divide-border/60">
                    {myTrades.map((trade) => (
                      <li key={trade.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                              {(trade.option_id && optionLabels.get(trade.option_id)) ??
                                trade.side?.toUpperCase() ??
                                "—"}
                            </Badge>
                            <StatusBadge status={trade.status} className="px-1.5 py-0 text-[10px]" />
                          </div>
                          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
                            {formatCurrency(trade.amount)} USDG @ {Math.round(toNumber(trade.price) * 100)}¢
                            {" · "}
                            {toNumber(trade.shares).toFixed(2)} shares
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <div className="text-right">
                            <p
                              className={cn(
                                "font-mono text-sm font-semibold tabular-nums",
                                trade.status === "won" && "text-emerald-400",
                                trade.status === "lost" && "text-rose-400"
                              )}
                            >
                              {trade.status === "open"
                                ? formatCurrency(trade.potential_payout)
                                : formatCurrency(trade.payout)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {trade.status === "open" ? "potential" : "settled"}
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
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <TradePanel
            market={market}
            options={options}
            wallet={wallet}
            settings={settings}
            isAuthenticated={Boolean(user)}
          />
          <AdSlot placement="market_detail" className="p-2" />
        </aside>
      </div>
    </div>
  );
}
