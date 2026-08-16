import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  Coins,
  Percent,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { StatusBadge } from "@/components/shared/status-badge";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { cn, formatCurrency, toNumber } from "@/lib/utils";
import type { DepositRequest, Market, WithdrawRequest } from "@/types/database";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

interface AdminStats {
  total_users: number;
  new_users_today: number;
  active_users: number;
  total_markets: number;
  open_markets: number;
  total_trades: number;
  total_volume: string;
  volume_today: string;
  total_fees: string;
  fees_today: string;
  total_deposits: string;
  total_withdrawals: string;
  pending_deposits: number;
  pending_withdrawals: number;
  pending_kyc: number;
  total_payouts: string;
  platform_balance: string;
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: statsData }, { data: depositRows }, { data: withdrawRows }, { data: marketRows }] =
    await Promise.all([
      supabase.rpc("admin_dashboard_stats"),
      supabase
        .from("deposit_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(5),
      supabase
        .from("withdraw_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(5),
      supabase
        .from("markets")
        .select("*")
        .eq("status", "closed")
        .order("end_time", { ascending: true })
        .limit(5),
    ]);

  const stats = (statsData ?? {}) as Partial<AdminStats>;
  const deposits = (depositRows as DepositRequest[]) ?? [];
  const withdrawals = (withdrawRows as WithdrawRequest[]) ?? [];
  const awaitingResolution = (marketRows as Market[]) ?? [];

  const revenue = toNumber(stats.total_fees);
  const netFlow = toNumber(stats.total_deposits) - toNumber(stats.total_withdrawals);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform health, revenue and everything waiting on your review.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          numericValue={stats.total_users ?? 0}
          kind="int"
          icon={Users}
          accent="primary"
          hint={`+${stats.new_users_today ?? 0} today · ${stats.active_users ?? 0} active`}
        />
        <StatCard
          label="Total volume"
          numericValue={toNumber(stats.total_volume ?? 0)}
          kind="currency"
          suffix=" USDG"
          icon={TrendingUp}
          accent="accent"
          hint={`${formatCurrency(stats.volume_today ?? 0)} today`}
        />
        <StatCard
          label="Fee revenue"
          numericValue={revenue}
          kind="currency"
          suffix=" USDG"
          icon={Percent}
          accent="success"
          hint={`${formatCurrency(stats.fees_today ?? 0)} today`}
        />
        <StatCard
          label="Platform balance"
          numericValue={toNumber(stats.platform_balance ?? 0)}
          kind="currency"
          suffix=" USDG"
          icon={Wallet}
          accent="warning"
          hint="Sum of all user wallets"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QueueCard
          href="/admin/deposits"
          label="Pending deposits"
          count={stats.pending_deposits ?? 0}
          icon={ArrowDownToLine}
          tone="text-emerald-400 bg-emerald-500/10"
        />
        <QueueCard
          href="/admin/withdrawals"
          label="Pending withdrawals"
          count={stats.pending_withdrawals ?? 0}
          icon={ArrowUpFromLine}
          tone="text-rose-400 bg-rose-500/10"
        />
        <QueueCard
          href="/admin/kyc"
          label="KYC to review"
          count={stats.pending_kyc ?? 0}
          icon={BadgeCheck}
          tone="text-cyan-400 bg-cyan-500/10"
        />
        <QueueCard
          href="/admin/markets?status=closed"
          label="Awaiting resolution"
          count={awaitingResolution.length}
          icon={Trophy}
          tone="text-amber-400 bg-amber-500/10"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Revenue</CardTitle>
            <CardDescription>Fees collected from trades and cancellations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Total fees" value={`${formatCurrency(revenue)} USDG`} tone="text-emerald-400" />
            <Row label="Fees today" value={`${formatCurrency(stats.fees_today ?? 0)} USDG`} />
            <Row label="Payouts made" value={`${formatCurrency(stats.total_payouts ?? 0)} USDG`} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cash flow</CardTitle>
            <CardDescription>Approved deposits versus withdrawals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Deposits in"
              value={`${formatCurrency(stats.total_deposits ?? 0)} USDG`}
              tone="text-emerald-400"
            />
            <Row
              label="Withdrawals out"
              value={`${formatCurrency(stats.total_withdrawals ?? 0)} USDG`}
              tone="text-rose-400"
            />
            <div className="border-t border-border/60 pt-2">
              <Row
                label="Net flow"
                value={`${netFlow >= 0 ? "+" : ""}${formatCurrency(netFlow)} USDG`}
                tone={netFlow >= 0 ? "text-emerald-400" : "text-rose-400"}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Activity</CardTitle>
            <CardDescription>Markets and trades across the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Total markets" value={(stats.total_markets ?? 0).toLocaleString()} />
            <Row label="Open markets" value={(stats.open_markets ?? 0).toLocaleString()} />
            <Row label="Total trades" value={(stats.total_trades ?? 0).toLocaleString()} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Deposits waiting</CardTitle>
              <CardDescription>Oldest first.</CardDescription>
            </div>
            <Link href="/admin/deposits" className="text-xs font-medium text-primary">
              Review all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {deposits.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">Nothing pending. Nice work.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {deposits.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <Coins className="size-4 shrink-0 text-emerald-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {formatCurrency(item.amount)} {item.asset}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Withdrawals waiting</CardTitle>
              <CardDescription>Funds are already on hold.</CardDescription>
            </div>
            <Link href="/admin/withdrawals" className="text-xs font-medium text-primary">
              Review all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {withdrawals.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">Nothing pending.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {withdrawals.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <ArrowUpFromLine className="size-4 shrink-0 text-rose-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {formatCurrency(item.amount)} {item.asset}
                        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                          net {formatCurrency(item.net_amount)}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {awaitingResolution.length > 0 && (
        <Card className="glass border-amber-500/30">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Markets awaiting resolution</CardTitle>
              <CardDescription>
                These closed markets still hold open positions. Resolve them to settle traders.
              </CardDescription>
            </div>
            <Link href="/admin/markets?status=closed" className="text-xs font-medium text-primary">
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {awaitingResolution.map((market) => (
                <li key={market.id} className="flex items-center gap-3 px-4 py-3">
                  <Trophy className="size-4 shrink-0 text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{market.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Closed{" "}
                      {new Date(market.end_time).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      · {formatCurrency(market.total_volume)} volume
                    </p>
                  </div>
                  <Link
                    href={`/admin/markets/${market.id}`}
                    className="shrink-0 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    Resolve
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QueueCard({
  href,
  label,
  count,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  count: number;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <Link href={href} className="group">
      <Card
        className={cn(
          "glass lift h-full transition-colors group-hover:border-primary/40",
          count > 0 && "border-primary/30"
        )}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-2xl font-semibold tabular-nums">
              <AnimatedNumber value={count} kind="int" />
            </p>
            <p className="truncate text-xs text-muted-foreground">{label}</p>
          </div>
          {count > 0 && (
            <span className="ml-auto shrink-0 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Review
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-medium tabular-nums", tone)}>{value}</span>
    </div>
  );
}
