import { Suspense } from "react";
import { Flame, Radio } from "lucide-react";
import { Hero } from "@/components/landing/hero";
import { SportsNav } from "@/components/landing/sports-nav";
import { MarketSection } from "@/components/landing/market-section";
import { Stats } from "@/components/landing/stats";
import { Faq } from "@/components/landing/faq";
import { Partners } from "@/components/landing/partners";
import { PromoBanners } from "@/components/shared/promo-banners";
import { Skeleton } from "@/components/ui/skeleton";
import { getUser } from "@/lib/auth";
import {
  getActiveBanners,
  getLiveMarkets,
  getPartners,
  getPublicStats,
  getTrendingMarkets,
} from "@/lib/queries";

export const revalidate = 30;

function MarketGridSkeleton() {
  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-56 rounded-xl" />
      ))}
    </div>
  );
}

async function LiveMarkets() {
  const markets = await getLiveMarkets(8);
  return (
    <MarketSection
      title={
        <span className="inline-flex items-center gap-2">
          <Radio className="size-6 text-emerald-400" />
          Live markets
        </span>
      }
      description="Events in play right now — prices move as the crowd trades."
      markets={markets}
      href="/markets?status=open"
    />
  );
}

async function TrendingMarkets() {
  const markets = await getTrendingMarkets(8);
  return (
    <MarketSection
      title={
        <span className="inline-flex items-center gap-2">
          <Flame className="size-6 text-amber-400" />
          Trending
        </span>
      }
      description="The highest-volume questions on the exchange."
      markets={markets}
      href="/markets?sort=volume"
    />
  );
}

async function PromoSection() {
  const [banners, user] = await Promise.all([getActiveBanners(), getUser()]);
  if (banners.length === 0) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <PromoBanners banners={banners} isAuthenticated={Boolean(user)} />
    </div>
  );
}

async function PartnersSection() {
  const partners = await getPartners();
  return <Partners partners={partners} />;
}

export default async function HomePage() {
  const stats = await getPublicStats();

  return (
    <>
      <Hero
        totalVolume={stats.totalVolume}
        openMarkets={stats.openMarkets}
        traders={stats.totalUsers}
      />

      <Suspense fallback={null}>
        <PromoSection />
      </Suspense>

      <SportsNav counts={stats.sportCounts} />

      <Suspense fallback={<MarketGridSkeleton />}>
        <LiveMarkets />
      </Suspense>

      <Suspense fallback={<MarketGridSkeleton />}>
        <TrendingMarkets />
      </Suspense>

      <Stats
        totalVolume={stats.totalVolume}
        totalTrades={stats.totalTrades}
        totalUsers={stats.totalUsers}
        resolvedMarkets={stats.resolvedMarkets}
      />

      <Suspense fallback={null}>
        <PartnersSection />
      </Suspense>

      <Faq />
    </>
  );
}
