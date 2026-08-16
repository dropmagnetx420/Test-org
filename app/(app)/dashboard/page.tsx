import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  Bell,
  Gift,
  Percent,
  TrendingUp,
  Trophy,
  Users,
  Wallet as WalletIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/shared/stat-card";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, getWallet } from "@/lib/auth";
import { cn, formatCurrency, toNumber } from "@/lib/utils";
import type { Notification, TradeWithMarket } from "@/types/database";

export const metadata: Metadata = { title: "Dashboard" };

interface DashboardStats {
  open_positions: number;
  open_stake: string;
  total_trades: number;
  won_trades: number;
  lost_trades: number;
  total_volume: string;
  net_profit: string;
  unread_notifications: number;
  referral_count: number;
  referral_earnings: string;
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const wallet = await getWallet();
  const supabase = await createClient();

  const [statsRes, tradesRes, notificationsRes] = await Promise.all([
    supabase.rpc("user_dashboard_stats"),
    supabase
      .from("trades")
      .select(
        "*,market:markets(id,slug,title,sport,team_a,team_b,status,end_time,resolved_outcome,yes_label,no_label),option:market_options(id,label,is_winner)"
      )
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${profile.id},is_broadcast.eq.true`)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const stats = (statsRes.data as DashboardStats | null) ?? {
    open_positions: 0,
    open_stake: "0",
    total_trades: 0,
    won_trades: 0,
    lost_trades: 0,
    total_volume: "0",
    net_profit: "0",
    unread_notifications: 0,
    referral_count: 0,
    referral_earnings: "0",
  };

  const trades = (tradesRes.data as unknown as TradeWithMarket[]) ?? [];
  const notifications = (notificationsRes.data as Notification[]) ?? [];

  const settled = stats.won_trades + stats.lost_trades;
  const winRate = settled > 0 ? (stats.won_trades / settled) * 100 : 0;
  const netProfit = toNumber(stats.net_profit);

  const turnoverRequired = toNumber(wallet?.bonus_turnover_required);
  const turnoverDone = toNumber(wallet?.bonus_turnover_completed);
  const turnoverPct =
    turnoverRequired > 0 ? Math.min(100, (turnoverDone / turnoverRequired) * 100) : 100;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back
            {profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge status={profile.kyc_status} className="px-1.5 py-0 text-[10px]" />
            {profile.kyc_status === "approved" ? "Identity verified" : "Verification required to withdraw"}
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="gradient" size="sm">
            <Link href="/wallet/deposit">
              <ArrowDownToLine className="size-4" />
              Deposit
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/markets">Browse markets</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Available balance"
          numericValue={toNumber(wallet?.available_balance ?? 0)}
          kind="currency"
          hint="Withdrawable USDG"
          icon={WalletIcon}
          accent="primary"
        />
        <StatCard
          label="Bonus balance"
          numericValue={toNumber(wallet?.bonus_balance ?? 0)}
          kind="currency"
          hint="Tradeable, turnover applies"
          icon={Gift}
          accent="accent"
        />
        <StatCard
          label="Open positions"
          numericValue={stats.open_positions}
          kind="int"
          hint={`${formatCurrency(stats.open_stake)} at stake`}
          icon={TrendingUp}
          accent="warning"
        />
        <StatCard
          label="Net profit"
          numericValue={netProfit}
          kind="currency"
          prefix={netProfit >= 0 ? "+" : ""}
          hint={`${stats.total_trades} predictions placed`}
          icon={Trophy}
          accent={netProfit >= 0 ? "success" : "destructive"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="size-4 text-primary" />
              Win rate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-mono text-3xl font-semibold tabular-nums">{winRate.toFixed(1)}%</p>
            <Progress value={winRate} />
            <p className="text-xs text-muted-foreground">
              {stats.won_trades} won · {stats.lost_trades} lost · {formatCurrency(stats.total_volume)}{" "}
              USDG traded
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="size-4 text-cyan-400" />
              Bonus turnover
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-mono text-3xl font-semibold tabular-nums">
              <AnimatedNumber value={turnoverPct} kind="int" />%
            </p>
            <Progress value={turnoverPct} />
            <p className="text-xs text-muted-foreground">
              {turnoverRequired > 0
                ? `${formatCurrency(turnoverDone)} of ${formatCurrency(turnoverRequired)} USDG traded`
                : "No active turnover requirement."}
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-emerald-400" />
              Referrals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-mono text-3xl font-semibold tabular-nums">
              <AnimatedNumber value={stats.referral_count} kind="int" />
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats.referral_earnings)} USDG earned in commission
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/referrals">Invite friends</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent predictions</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/predictions">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {trades.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No predictions yet"
                description="Pick a market and buy YES or NO to open your first position."
                actionLabel="Browse markets"
                actionHref="/markets"
                className="border-0 py-8"
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {trades.map((trade) => (
                  <li key={trade.id}>
                    <Link
                      href={`/markets/${trade.market.slug}`}
                      className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-primary"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{trade.market.title}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                            {trade.option?.label ?? trade.side?.toUpperCase() ?? "—"}
                          </Badge>
                          <StatusBadge status={trade.status} className="px-1.5 py-0 text-[10px]" />
                        </div>
                      </div>
                      <p className="shrink-0 font-mono text-sm tabular-nums">
                        {formatCurrency(trade.amount)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Notifications
              {stats.unread_notifications > 0 && (
                <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                  {stats.unread_notifications}
                </Badge>
              )}
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/notifications">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="You're all caught up"
                description="Deposit confirmations, settlements and announcements land here."
                className="border-0 py-8"
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {notifications.map((item) => (
                  <li key={item.id} className="flex gap-3 py-3">
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        item.is_read ? "bg-muted-foreground/40" : "bg-primary"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {profile.kyc_status !== "approved" && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 size-5 shrink-0 text-amber-400" />
              <div>
                <p className="font-medium">Verify your identity</p>
                <p className="text-sm text-muted-foreground">
                  Verification is required before your first withdrawal. It usually takes under a
                  day.
                </p>
              </div>
            </div>
            <Button asChild variant="gradient" size="sm">
              <Link href="/kyc">
                <ArrowUpFromLine className="size-4" />
                Start verification
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
