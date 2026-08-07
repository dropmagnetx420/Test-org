import Link from "next/link";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserActions } from "@/components/admin/user-actions";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { DEFAULTS } from "@/lib/constants";
import { cn, formatCurrency, toNumber, truncateAddress } from "@/lib/utils";
import type { Profile, Wallet } from "@/types/database";

export const metadata: Metadata = { title: "Users · Admin" };
export const dynamic = "force-dynamic";

const TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
  { value: "admin", label: "Staff" },
];

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { status = "all", q = "", page: pageParam } = await searchParams;
  const admin = await requireAdmin();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const from = (page - 1) * DEFAULTS.PAGE_SIZE;
  const term = q.trim();

  const supabase = await createClient();
  let query = supabase.from("profiles").select("*", { count: "exact" });

  if (status === "admin") query = query.in("role", ["admin", "super_admin"]);
  else if (status !== "all") query = query.eq("status", status);

  if (term) {
    const safe = term.replace(/[%,()]/g, "");
    query = query.or(`email.ilike.%${safe}%,username.ilike.%${safe}%,full_name.ilike.%${safe}%`);
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + DEFAULTS.PAGE_SIZE - 1);

  const users = (data as Profile[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULTS.PAGE_SIZE));

  const { data: walletRows } = users.length
    ? await supabase
        .from("wallets")
        .select("*")
        .in(
          "user_id",
          users.map((u) => u.id)
        )
    : { data: [] };

  const wallets = new Map(((walletRows as Wallet[]) ?? []).map((w) => [w.user_id, w]));

  function tabHref(value: string) {
    const params = new URLSearchParams({ status: value });
    if (term) params.set("q", term);
    return `/admin/users?${params.toString()}`;
  }

  const baseHref = `/admin/users?${new URLSearchParams(
    term ? { status, q: term } : { status }
  ).toString()}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total.toLocaleString()} account{total === 1 ? "" : "s"}. Suspend, ban, adjust balances, or
          grant staff access.
        </p>
      </header>

      <form action="/admin/users" className="flex flex-wrap gap-2">
        <input type="hidden" name="status" value={status} />
        <Input
          name="q"
          defaultValue={term}
          placeholder="Search email, username, or name…"
          className="h-9 min-w-0 flex-1 sm:max-w-xs"
          aria-label="Search users"
        />
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
        {term && (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/admin/users?status=${status}`}>Clear</Link>
          </Button>
        )}
      </form>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tabHref(tab.value)}
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

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={term ? "No matches" : "No users here"}
          description={
            term ? `Nothing found for “${term}”.` : "Try a different filter to see more accounts."
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {users.map((user) => {
              const wallet = wallets.get(user.id);
              const name = user.full_name || user.username || user.email;

              return (
                <Card key={user.id} className="glass">
                  <CardContent className="flex flex-wrap items-start gap-4 p-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold">{name}</p>
                        <StatusBadge status={user.status} />
                        {user.role !== "user" && <StatusBadge status={user.role} />}
                        <StatusBadge status={user.kyc_status} />
                      </div>

                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>

                      <dl className="grid gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
                        <Field
                          label="Available"
                          value={`${formatCurrency(wallet?.available_balance ?? 0)} USDG`}
                          mono
                        />
                        <Field
                          label="Bonus"
                          value={`${formatCurrency(wallet?.bonus_balance ?? 0)} USDG`}
                          mono
                        />
                        <Field
                          label="Locked"
                          value={`${formatCurrency(wallet?.locked_balance ?? 0)} USDG`}
                          mono
                        />
                        <Field label="Trades" value={user.total_trades.toLocaleString()} />
                        <Field
                          label="Volume"
                          value={`${formatCurrency(user.total_volume)} USDG`}
                          mono
                        />
                        <Field label="Referral code" value={user.referral_code} mono />
                        <Field label="ID" value={truncateAddress(user.id, 8, 6)} mono />
                        <Field
                          label="Joined"
                          value={new Date(user.created_at).toLocaleDateString("en-US", {
                            dateStyle: "medium",
                          })}
                        />
                        {user.last_login_at && (
                          <Field
                            label="Last seen"
                            value={new Date(user.last_login_at).toLocaleString("en-US", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          />
                        )}
                      </dl>

                      {user.status === "suspended" && user.suspended_until && (
                        <p className="text-xs text-amber-300">
                          Suspended until{" "}
                          {new Date(user.suspended_until).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      )}
                      {user.ban_reason && (
                        <p className="text-xs text-red-400">Reason: {user.ban_reason}</p>
                      )}
                      {toNumber(wallet?.bonus_turnover_required ?? 0) >
                        toNumber(wallet?.bonus_turnover_completed ?? 0) && (
                        <p className="text-xs text-muted-foreground">
                          Turnover {formatCurrency(wallet?.bonus_turnover_completed ?? 0)} /{" "}
                          {formatCurrency(wallet?.bonus_turnover_required ?? 0)} USDG
                        </p>
                      )}
                    </div>

                    <UserActions
                      userId={user.id}
                      name={name}
                      status={user.status}
                      role={user.role}
                      isSuperAdmin={admin.role === "super_admin"}
                      isSelf={admin.id === user.id}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Pagination page={page} totalPages={totalPages} baseHref={baseHref} />
        </>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("truncate", mono && "font-mono")}>{value}</dd>
    </div>
  );
}
