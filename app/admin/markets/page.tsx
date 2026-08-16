import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { StaggerGrid, StaggerItem } from "@/components/shared/motion";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { CloseExpiredButton } from "@/components/admin/close-expired-button";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { DEFAULTS, SPORTS } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";
import type { Market } from "@/types/database";

export const metadata: Metadata = { title: "Markets · Admin" };
export const dynamic = "force-dynamic";

const TABS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Needs resolving" },
  { value: "resolved", label: "Resolved" },
  { value: "cancelled", label: "Cancelled" },
];

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}

export default async function AdminMarketsPage({ searchParams }: PageProps) {
  const { status = "all", q = "", page: pageParam } = await searchParams;
  await requireAdmin();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const from = (page - 1) * DEFAULTS.PAGE_SIZE;
  const term = q.trim();

  const supabase = await createClient();
  let query = supabase.from("markets").select("*", { count: "exact" });
  if (status !== "all") query = query.eq("status", status);
  if (term) query = query.ilike("title", `%${term.replace(/[%,()]/g, "")}%`);

  const [{ data, count }, { count: expiredCount }] = await Promise.all([
    query
      .order("end_time", { ascending: status === "closed" })
      .range(from, from + DEFAULTS.PAGE_SIZE - 1),
    supabase
      .from("markets")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .lt("end_time", new Date().toISOString()),
  ]);

  const markets = (data as Market[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULTS.PAGE_SIZE));
  const expired = expiredCount ?? 0;

  function tabHref(value: string) {
    const params = new URLSearchParams({ status: value });
    if (term) params.set("q", term);
    return `/admin/markets?${params.toString()}`;
  }

  const baseHref = `/admin/markets?${new URLSearchParams(
    term ? { status, q: term } : { status }
  ).toString()}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Markets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total.toLocaleString()} market{total === 1 ? "" : "s"}. Create, price, and resolve
            prediction markets.
          </p>
        </div>
        <Button asChild variant="gradient" size="sm">
          <Link href="/admin/markets/new">
            <Plus className="size-4" />
            New market
          </Link>
        </Button>
      </header>

      {expired > 0 && (
        <Card className="glass border-amber-500/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">
              <span className="font-semibold text-amber-300">{expired}</span> open market
              {expired === 1 ? " has" : "s have"} passed their close time and are still accepting
              predictions.
            </p>
            <CloseExpiredButton />
          </CardContent>
        </Card>
      )}

      <form action="/admin/markets" className="flex flex-wrap gap-2">
        <input type="hidden" name="status" value={status} />
        <Input
          name="q"
          defaultValue={term}
          placeholder="Search market titles…"
          className="h-9 min-w-0 flex-1 sm:max-w-xs"
          aria-label="Search markets"
        />
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
        {term && (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/admin/markets?status=${status}`}>Clear</Link>
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

      {markets.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={term ? "No matches" : "No markets here"}
          description={
            term
              ? `Nothing found for “${term}”.`
              : "Create your first market to start taking predictions."
          }
          actionLabel="New market"
          actionHref="/admin/markets/new"
        />
      ) : (
        <>
          <StaggerGrid className="space-y-3">
            {markets.map((market) => {
              const sport = SPORTS.find((s) => s.value === market.sport);
              const ended = new Date(market.end_time) < new Date();

              return (
                <StaggerItem key={market.id}>
                <Card className="glass lift">
                  <CardContent className="flex flex-wrap items-start gap-4 p-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg leading-none">{sport?.icon}</span>
                        <Link
                          href={`/admin/markets/${market.id}`}
                          className="truncate text-base font-semibold hover:text-primary"
                        >
                          {market.title}
                        </Link>
                        <StatusBadge status={market.status} />
                        {market.is_featured && <Tag>Featured</Tag>}
                        {market.is_trending && <Tag>Trending</Tag>}
                        {market.status === "open" && ended && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                            Past close
                          </span>
                        )}
                      </div>

                      <dl className="grid gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
                        <Field label="League" value={market.league ?? sport?.label ?? "—"} />
                        <Field
                          label="Outcomes"
                          value={market.outcome_count?.toString() ?? "2"}
                        />
                        <Field
                          label="Volume"
                          value={`${formatCurrency(market.total_volume)} USDG`}
                          mono
                        />
                        <Field label="Trades" value={market.trade_count.toLocaleString()} />
                        <Field
                          label="Opens"
                          value={new Date(market.start_time).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        />
                        <Field
                          label="Closes"
                          value={new Date(market.end_time).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        />
                      </dl>

                      {market.resolved_outcome && (
                        <p className="text-xs text-emerald-300">
                          Resolved {market.resolved_outcome.toUpperCase()}
                          {market.resolution_note ? ` — ${market.resolution_note}` : ""}
                        </p>
                      )}
                    </div>

                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <Link href={`/admin/markets/${market.id}`}>
                        {market.status === "closed" ? "Resolve" : "Manage"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
                </StaggerItem>
              );
            })}
          </StaggerGrid>

          <Pagination page={page} totalPages={totalPages} baseHref={baseHref} />
        </>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {children}
    </span>
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
