import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { SPORTS } from "@/lib/constants";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Served on demand so the build never depends on the database being reachable. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select("slug, updated_at")
    .in("status", ["open", "closed", "resolved"])
    .order("updated_at", { ascending: false })
    .limit(2000);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/markets`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/register`, changeFrequency: "yearly", priority: 0.5 },
  ];

  const sportRoutes: MetadataRoute.Sitemap = SPORTS.map((sport) => ({
    url: `${SITE_URL}/markets?sport=${sport.value}`,
    changeFrequency: "hourly",
    priority: 0.7,
  }));

  const marketRoutes: MetadataRoute.Sitemap = (data ?? []).map((market) => ({
    url: `${SITE_URL}/markets/${market.slug}`,
    lastModified: new Date(market.updated_at),
    changeFrequency: "hourly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...sportRoutes, ...marketRoutes];
}
