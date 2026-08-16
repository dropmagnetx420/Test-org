import type { Metadata } from "next";
import { Coins, TrendingUp, UserPlus, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pagination } from "@/components/shared/pagination";
import { InviteCard } from "@/components/referrals/invite-card";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireProfile } from "@/lib/auth";
import { DEFAULTS } from "@/lib/constants";
import { formatCurrency, toNumber } from "@/lib/utils";
import type { Referral } from "@/types/database";

export const metadata: Metadata = { title: "Referrals" };

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

/** Referred users' profiles are not readable under RLS, so identify them by anonymised id. */
function displayName(row: Referral) {
  return `Member ${row.referred_id.slice(0, 6)}`;
}

export default async function ReferralsPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const profile = await requireProfile();
  const settings = await getSettings();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const from = (page - 1) * DEFAULTS.PAGE_SIZE;

  const supabase = await createClient();
  const [{ data, count }, { data: totalsRows }] = await Promise.all([
    supabase
      .from("referrals")
      .select("*", { count: "exact" })
      .eq("referrer_id", profile.id)
      .order("created_at", { ascending: false })
      .range(from, from + DEFAULTS.PAGE_SIZE - 1),
    supabase
      .from("referrals")
      .select("commission_earned, total_volume")
      .eq("referrer_id", profile.id),
  ]);

  const referrals = (data as Referral[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULTS.PAGE_SIZE));

  const totals = (totalsRows as Pick<Referral, "commission_earned" | "total_volume">[]) ?? [];
  const earnings = totals.reduce((sum, row) => sum + toNumber(row.commission_earned), 0);
  const volume = totals.reduce((sum, row) => sum + toNumber(row.total_volume), 0);
  const active = totals.filter((row) => toNumber(row.total_volume) > 0).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Referrals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Earn a share of every trade your invites place — forever.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total referrals" numericValue={total} kind="int" icon={Users} accent="primary" />
        <StatCard
          label="Active traders"
          numericValue={active}
          kind="int"
          icon={TrendingUp}
          accent="accent"
          hint="Referrals who have traded"
        />
        <StatCard
          label="Commission earned"
          numericValue={earnings}
          kind="currency"
          suffix=" USDG"
          icon={Coins}
          accent="success"
        />
        <StatCard
          label="Referred volume"
          numericValue={volume}
          kind="currency"
          suffix=" USDG"
          icon={UserPlus}
          accent="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <InviteCard
          code={profile.referral_code}
          commission={String(toNumber(settings.referral_commission_percent))}
          signupReward={toNumber(settings.referral_signup_reward)}
        />

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Referral history</CardTitle>
            <CardDescription>
              Commission is credited to your cash balance the moment a referral trades.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {referrals.length === 0 ? (
              <div className="px-6 pb-6">
                <EmptyState
                  icon={Users}
                  title="No referrals yet"
                  description="Share your invite link — you'll see everyone who joins here."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {referrals.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
                      {displayName(row).slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{displayName(row)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Joined{" "}
                        {new Date(row.created_at).toLocaleDateString("en-US", {
                          dateStyle: "medium",
                        })}{" "}
                        · code {row.code_used}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums text-emerald-400">
                        +{formatCurrency(row.commission_earned)}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
                        vol {formatCurrency(row.total_volume)}
                      </p>
                    </div>

                    <StatusBadge status={row.status} className="hidden shrink-0 sm:inline-flex" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} baseHref="/referrals" />
      )}
    </div>
  );
}
