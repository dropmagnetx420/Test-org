import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketCard } from "@/components/shared/market-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import type { Market } from "@/types/database";

interface MarketSectionProps {
  title: React.ReactNode;
  description?: string;
  markets: Market[];
  href?: string;
  emptyMessage?: string;
}

export function MarketSection({
  title,
  description,
  markets,
  href = "/markets",
  emptyMessage = "No markets here yet. Check back shortly.",
}: MarketSectionProps) {
  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={href}>
              View all
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        {markets.length === 0 ? (
          <EmptyState title="Nothing live right now" description={emptyMessage} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {markets.map((market, i) => (
              <div
                key={market.id}
                className="reveal"
                style={{ animationDelay: `${Math.min(i, 7) * 45}ms` }}
              >
                <MarketCard market={market} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
