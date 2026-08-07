import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { MarketCard } from "@/components/shared/market-card";
import { MarketFilters } from "@/components/markets/market-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { AdSlot } from "@/components/shared/ad-slot";
import { StaggerGrid, StaggerItem } from "@/components/shared/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { listMarkets } from "@/lib/queries";
import { SPORTS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Browse every open sports prediction market — football, cricket, basketball, tennis and esports.",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function MarketResults({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const sport = first(searchParams.sport);
  const status = first(searchParams.status);
  const search = first(searchParams.search);
  const sort = first(searchParams.sort);
  const page = Number(first(searchParams.page) ?? 1) || 1;

  const result = await listMarkets({ sport, status, search, sort, page });

  const query = new URLSearchParams();
  if (sport) query.set("sport", sport);
  if (status) query.set("status", status);
  if (search) query.set("search", search);
  if (sort) query.set("sort", sort);
  const baseHref = query.toString() ? `/markets?${query}` : "/markets";

  if (result.items.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No markets match those filters"
        description="Try a different sport, clear the search, or check back soon — new markets open daily."
        actionLabel="Clear filters"
        actionHref="/markets"
      />
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        {result.total.toLocaleString()} market{result.total === 1 ? "" : "s"}
        {sport && ` in ${SPORTS.find((s) => s.value === sport)?.label ?? sport}`}
      </p>

      <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {result.items.map((market) => (
          <StaggerItem key={market.id}>
            <MarketCard market={market} />
          </StaggerItem>
        ))}
      </StaggerGrid>

      <AdSlot placement="in_feed" className="p-2" />

      <Pagination page={result.page} totalPages={result.totalPages} baseHref={baseHref} />
    </div>
  );
}

export default async function MarketsPage({ searchParams }: PageProps) {
  const resolved = await searchParams;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Prediction <span className="text-gradient">markets</span>
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every market resolves against the official result. Buy YES or NO, and cancel any open
          position before the event settles.
        </p>
      </header>

      <div className="mb-8">
        <Suspense fallback={<Skeleton className="h-32 w-full rounded-xl" />}>
          <MarketFilters />
        </Suspense>
      </div>

      <Suspense
        key={JSON.stringify(resolved)}
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        }
      >
        <MarketResults searchParams={resolved} />
      </Suspense>
    </div>
  );
}
