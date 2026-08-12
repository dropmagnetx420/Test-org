import type { Metadata } from "next";
import { PromoBanners } from "@/components/shared/promo-banners";
import type { PromoBanner } from "@/types/database";

export const metadata: Metadata = {
  title: "Banner preview",
  robots: { index: false, follow: false },
};

const base: PromoBanner = {
  id: "1",
  title: "Welcome bonus: 50 USDG on your first deposit",
  subtitle: "Deposit any amount today and we top it up instantly. Limited spots.",
  image_url: null,
  link_url: "/register",
  cta_text: null,
  bg_gradient: null,
  position: 0,
  is_active: true,
  bonus_amount: "50",
  user_limit: 500,
  claimed_count: 320,
  starts_at: null,
  ends_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const banners: PromoBanner[] = [
  base,
  { ...base, id: "2", title: "Refer a friend, both of you earn", bonus_amount: "0" },
];

export default function BannerPreviewPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PromoBanners banners={banners} isAuthenticated={false} />
    </div>
  );
}
