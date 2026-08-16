import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { StatusBadge } from "@/components/shared/status-badge";
import { MarketForm } from "@/components/admin/market-form";
import { MarketActions } from "@/components/admin/market-actions";
import { VolumeSeeder } from "@/components/admin/volume-seeder";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { cn, formatCurrency, toNumber, truncateAddress } from "@/lib/utils";
import type { Market, MarketOption, Trade } from "@/types/database";

export const metadata: Metadata = { title: "Market · Admin" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminMarketDetailPage({ params }: PageProps) {
  const { id } = await params;
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.from("markets").select("*").eq("id", id).single();
  if (!data) notFound();

  const market = data as Market;

  const [{ data: tradeRows }, { data: optionRows }] = await Promise.all([
    supabase
      .from("trades")
      .select("*")
      .eq("market_id", market.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("market_options")
      .select("*")
      .eq("market_id", market.id)
      .order("position", { ascending: true }),
  ]);

  const trades = (tradeRows as Trade[]) ?? [];
  const options = (optionRows as MarketOption[]) ?? [];
  const optionLabels = new Map(options.map((option) => [option.id, option.label]));
  const totalVolume = options.reduce((sum, option) => sum + toNumber(option.volume), 0);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/markets">
            <ArrowLeft className="size-4" />
            Markets
          </Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{market.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={market.status} />
              <span className="text-xs text-muted-foreground">
                <AnimatedNumber value={market.trade_count} kind="int" /> trade
                {market.trade_count === 1 ? "" : "s"} ·{" "}
                <AnimatedNumber value={toNumber(market.total_volume)} kind="currency" /> USDG volume
              </span>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/markets/${market.slug}`} target="_blank">
              <ExternalLink className="size-4" />
              View public page
            </Link>
          </Button>
        </div>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Resolution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {options.map((option) => {
              const volume = toNumber(option.volume);
              const share = totalVolume > 0 ? (volume / totalVolume) * 100 : 100 / options.length;

              return (
                <div key={option.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">
                      {option.label}
                      {option.is_winner && (
                        <span className="ml-2 text-emerald-300">winner</span>
                      )}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {Math.round(toNumber(option.odds) * 100)}¢ · {formatCurrency(volume)} USDG
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <MarketActions market={market} options={options} />
        </CardContent>
      </Card>

      {options.length > 0 && market.status !== "resolved" && market.status !== "cancelled" && (
        <VolumeSeeder marketId={market.id} options={options} />
      )}

      {trades.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Recent positions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2 text-xs last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                      trade.status === "won"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {(trade.option_id && optionLabels.get(trade.option_id)) ??
                      trade.side?.toUpperCase() ??
                      "—"}
                  </span>
                  <span className="font-mono">{truncateAddress(trade.user_id, 6, 4)}</span>
                  <StatusBadge status={trade.status} />
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <span>{formatCurrency(trade.amount)} USDG</span>
                  <span className="text-muted-foreground">
                    @ {Number(trade.price).toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(trade.created_at).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold">Edit details</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Changes apply immediately to the public market page.
        </p>
        <MarketForm market={market} options={options} />
      </div>
    </div>
  );
}
