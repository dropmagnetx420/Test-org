import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

/**
 * Bare paths, not `/admin/` — robots.txt matches on prefix, so the bare form
 * covers the index page as well as everything nested under it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/auth",
        "/dashboard",
        "/wallet",
        "/kyc",
        "/profile",
        "/referrals",
        "/earn",
        "/foisal420",
        "/banned",
        "/reset-password",
        "/forgot-password",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
