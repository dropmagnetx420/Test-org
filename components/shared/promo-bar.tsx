import { PromoBanners } from "@/components/shared/promo-banners";
import { getUser } from "@/lib/auth";
import { getActiveBanners } from "@/lib/queries";

export async function PromoBar({ className }: { className?: string }) {
  const [banners, user] = await Promise.all([getActiveBanners(), getUser()]);
  if (banners.length === 0) return null;

  return (
    <div className={className}>
      <PromoBanners banners={banners} isAuthenticated={Boolean(user)} />
    </div>
  );
}
