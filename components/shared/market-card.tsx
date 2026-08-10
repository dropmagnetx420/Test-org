import Link from "next/link";
import { Flame, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "@/components/shared/countdown";
import { StatusBadge } from "@/components/shared/status-badge";
import { SPORTS } from "@/lib/constants";
import { cn, formatCompact, toNumber } from "@/lib/utils";
import type { Market } from "@/types/database";

function sportMeta(sport: string) {
  return SPORTS.find((s) => s.value === sport) ?? SPORTS[0];
}

export function MarketCard({ market, compact = false }: { market: Market; compact?: boolean }) {
  const meta = sportMeta(market.sport);
  const leadPct = Math.round(toNumber(market.yes_odds) * 100);
  const isMultiway = (market.outcome_count ?? 2) > 2;
  const isLive = market.status === "open" && new Date(market.start_time) <= new Date();

  return (
    <div className="lift h-full">
      <Link
        href={`/markets/${market.slug}`}
        className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl transition-colors hover:border-primary/50"
      >
        <div
          className={cn(
            "pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-gradient-to-br opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-30",
            meta.gradient
          )}
        />

        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "grid size-8 place-items-center rounded-lg bg-gradient-to-br text-sm",
                meta.gradient
              )}
            >
              {meta.icon}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{meta.label}</p>
              {market.league && (
                <p className="truncate text-[11px] text-muted-foreground/70">{market.league}</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {market.is_trending && (
              <Badge variant="warning" className="gap-1 px-1.5 py-0 text-[10px]">
                <Flame className="size-2.5" />
                Hot
              </Badge>
            )}
            {isLive ? (
              <Badge variant="success" className="gap-1 px-1.5 py-0 text-[10px]">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                </span>
                Live
              </Badge>
            ) : (
              <StatusBadge status={market.status} className="px-1.5 py-0 text-[10px]" />
            )}
          </div>
        </div>

        <h3
          className={cn(
            "font-semibold leading-snug transition-colors group-hover:text-primary",
            compact ? "line-clamp-2 text-sm" : "line-clamp-2 text-base"
          )}
        >
          {market.title}
        </h3>

        <div className="mt-auto space-y-3">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${leadPct}%` }}
            />
            <div
              className="bg-gradient-to-r from-rose-500 to-red-400 transition-all duration-500"
              style={{ width: `${100 - leadPct}%` }}
            />
          </div>

          {isMultiway ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium">{market.yes_label}</span>
                <span className="font-mono tabular-nums">{leadPct}%</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {market.outcome_count} outcomes · see details
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                <p className="truncate text-[11px] font-medium text-emerald-300">
                  {market.yes_label}
                </p>
                <p className="font-mono text-lg font-semibold leading-none text-emerald-400 tabular-nums">
                  {leadPct}%
                </p>
              </div>
              <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2">
                <p className="truncate text-[11px] font-medium text-rose-300">{market.no_label}</p>
                <p className="font-mono text-lg font-semibold leading-none text-rose-400 tabular-nums">
                  {100 - leadPct}%
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="size-3" />
              {formatCompact(market.total_volume)} USDG
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              {market.trade_count}
            </span>
            <Countdown to={market.end_time} />
          </div>
        </div>
      </Link>
    </div>
  );
}
