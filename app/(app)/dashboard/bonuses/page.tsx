import type { Metadata } from "next";
import { Gift, PartyPopper, Sparkles, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pagination } from "@/components/shared/pagination";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireProfile } from "@/lib/auth";
import { DEFAULTS } from "@/lib/constants";
import { formatCurrency, toNumber } from "@/lib/utils";
import type { BonusHistory, Wallet } from "@/types/database";

export const metadata: Metadata = { title: "Bonuses" };

const BONUS_META: Record<string, { label: string; icon: typeof Gift }> = {
  welcome: { label: "Welcome bonus", icon: PartyPopper },
  deposit: { label: "Deposit bonus", icon: Sparkles },
  promo: { label: "Promotion", icon: Gift },
  referral: { label: "Referral bonus", icon: Gift },
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function BonusesPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const profile = await requireProfile();
  const settings = await getSettings();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const from = (page - 1) * DEFAULTS.PAGE_SIZE;

  const supabase = await createClient();
  const [{ data, count }, { data: walletRow }] = await Promise.all([
    supabase
      .from("bonus_history")
      .select("*", { count: "exact" })
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .range(from, from + DEFAULTS.PAGE_SIZE - 1),
    supabase.from("wallets").select("*").eq("user_id", profile.id).single(),
  ]);

  const bonuses = (data as BonusHistory[]) ?? [];
  const wallet = walletRow as Wallet | null;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULTS.PAGE_SIZE));

  const required = toNumber(wallet?.bonus_turnover_required);
  const completed = toNumber(wallet?.bonus_turnover_completed);
  const remaining = Math.max(0, required - completed);
  const pct = required > 0 ? Math.min(100, (completed / required) * 100) : 100;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Bonuses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every bonus you&apos;ve received and the turnover needed to unlock it.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Bonus balance"
          value={`${formatCurrency(wallet?.bonus_balance ?? 0)} USDG`}
          icon={Gift}
          accent="accent"
        />
        <StatCard
          label="Turnover completed"
          value={`${formatCurrency(completed)} USDG`}
          icon={Target}
          accent="primary"
          hint={required > 0 ? `of ${formatCurrency(required)} required` : "Nothing pending"}
        />
        <StatCard
          label="Bonuses received"
          value={total.toLocaleString()}
          icon={Sparkles}
          accent="success"
        />
      </div>

      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How bonus turnover works</CardTitle>
          <CardDescription>
            Bonus funds become withdrawable cash after you trade{" "}
            {toNumber(settings.bonus_turnover_multiplier)}× the bonus amount. Trades draw from your
            cash balance first, then bonus funds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {remaining > 0
              ? `${pct.toFixed(0)}% complete — trade ${formatCurrency(remaining)} USDG more to unlock your bonus.`
              : "All turnover requirements met. Bonus funds are unlocked."}
          </p>
        </CardContent>
      </Card>

      {bonuses.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No bonuses yet"
          description="Welcome bonuses, deposit bonuses and promotions all appear here."
          actionLabel="Make a deposit"
          actionHref="/wallet/deposit"
        />
      ) : (
        <>
          <Card className="glass overflow-hidden">
            <CardContent className="p-0">
              <ul className="divide-y divide-border/60">
                {bonuses.map((item) => {
                  const meta = BONUS_META[item.bonus_type] ?? {
                    label: item.bonus_type,
                    icon: Gift,
                  };
                  const Icon = meta.icon;
                  const itemRequired = toNumber(item.turnover_required);
                  const itemDone = toNumber(item.turnover_completed);
                  const itemPct =
                    itemRequired > 0 ? Math.min(100, (itemDone / itemRequired) * 100) : 100;

                  return (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-500/10 text-cyan-400">
                        <Icon className="size-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.description || meta.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {meta.label} ·{" "}
                          {new Date(item.created_at).toLocaleDateString("en-US", {
                            dateStyle: "medium",
                          })}
                          {item.expires_at &&
                            ` · expires ${new Date(item.expires_at).toLocaleDateString("en-US", {
                              dateStyle: "medium",
                            })}`}
                        </p>
                        {itemRequired > 0 && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1 w-24 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-cyan-500"
                                style={{ width: `${itemPct}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                              {formatCurrency(itemDone)} / {formatCurrency(itemRequired)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm font-semibold tabular-nums text-cyan-400">
                          +{formatCurrency(item.amount)}
                        </p>
                        <StatusBadge status={item.status} className="mt-1" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              baseHref="/dashboard/bonuses"
            />
          )}
        </>
      )}
    </div>
  );
}
