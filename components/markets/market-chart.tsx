"use client";

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toNumber } from "@/lib/utils";
import type { MarketOddsPoint, MarketOption } from "@/types/database";

// Matches the OUTCOME_BARS order on the market page, so a line's colour lines up
// with its probability bar above the chart.
const LINE_COLORS = [
  "#10b981",
  "#f43f5e",
  "#8b5cf6",
  "#f59e0b",
  "#0ea5e9",
  "#ec4899",
  "#84cc16",
  "#94a3b8",
];

interface ChartRow {
  t: number;
  [optionId: string]: number;
}

function toPct(odds: string) {
  return Math.round(toNumber(odds) * 100);
}

/** Snapshots share a timestamp per recalc, so grouping by it rebuilds one row
 *  per point in time with every outcome's probability side by side. */
function buildRows(history: MarketOddsPoint[]): ChartRow[] {
  const byTime = new Map<number, ChartRow>();
  for (const point of history) {
    const t = new Date(point.recorded_at).getTime();
    const row = byTime.get(t) ?? { t };
    row[point.option_id] = toPct(point.odds);
    byTime.set(t, row);
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

function formatTick(t: number) {
  return new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });
}

export function MarketChart({
  options,
  history,
}: {
  options: MarketOption[];
  history: MarketOddsPoint[];
}) {
  // recharts measures its container in an effect after mount, so it renders an
  // empty box on the server and fills in on the client — safe to render directly.
  const rows = useMemo(() => buildRows(history), [history]);
  const reduce = useReducedMotion();
  const active = options.filter((o) => o.is_active);
  const color = (position: number) => LINE_COLORS[position % LINE_COLORS.length];

  if (rows.length < 2) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium">Price history is building</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          The chart fills in as people trade this market and as odds move.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTick}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip content={<ChartTooltip options={active} />} />
          {active.map((option, index) => (
            <Line
              key={option.id}
              type="monotone"
              dataKey={option.id}
              name={option.label}
              stroke={color(option.position)}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!reduce}
              animationBegin={index * 120}
              animationDuration={900}
              animationEasing="ease-out"
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  options,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number | string;
  options: MarketOption[];
}) {
  if (!active || !payload?.length) return null;

  const byId = new Map(options.map((o) => [o.id, o]));
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 font-medium text-muted-foreground">
        {new Date(Number(label)).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
      <ul className="space-y-0.5">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: entry.color }} />
            <span className="truncate">{byId.get(String(entry.dataKey))?.label ?? entry.name}</span>
            <span className="ml-auto font-mono font-semibold tabular-nums">{entry.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
