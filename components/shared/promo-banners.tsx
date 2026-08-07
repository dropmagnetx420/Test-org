"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Gift, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { claimPromo } from "@/lib/actions/notifications";
import { cn, toNumber } from "@/lib/utils";
import type { PromoBanner } from "@/types/database";

export function PromoBanners({
  banners,
  isAuthenticated,
}: {
  banners: PromoBanner[];
  isAuthenticated: boolean;
}) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [claimed, setClaimed] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const visible = banners.filter((b) => !dismissed.includes(b.id));
  if (visible.length === 0) return null;

  function onClaim(banner: PromoBanner) {
    startTransition(async () => {
      const result = await claimPromo(banner.id);
      if (result.success) {
        setClaimed((prev) => [...prev, banner.id]);
        toast.success(result.message ?? "Offer claimed.");
      } else {
        toast.error(result.error ?? "Could not claim this offer.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {visible.map((banner, index) => {
        const bonus = toNumber(banner.bonus_amount);
        const seatsLeft =
          banner.user_limit != null ? Math.max(0, banner.user_limit - banner.claimed_count) : null;
        const isClaimed = claimed.includes(banner.id);

        return (
          <motion.div
            key={banner.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className={cn(
              "relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-r p-5 backdrop-blur-xl",
              banner.bg_gradient || "from-primary/20 via-violet-500/10 to-cyan-500/20"
            )}
          >
            <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-white/10 blur-3xl" />

            <button
              type="button"
              onClick={() => setDismissed((prev) => [...prev, banner.id])}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              aria-label="Dismiss offer"
            >
              <X className="size-4" />
            </button>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-primary">
                <Gift className="size-5" />
              </div>

              <div className="min-w-0 flex-1 pr-8">
                <p className="font-semibold">{banner.title}</p>
                {banner.subtitle && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{banner.subtitle}</p>
                )}
                {seatsLeft !== null && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-300">
                    <Sparkles className="size-3" />
                    {seatsLeft > 0
                      ? `${seatsLeft.toLocaleString()} spots left`
                      : "Fully claimed"}
                  </p>
                )}
              </div>

              <div className="shrink-0">
                {bonus > 0 && isAuthenticated ? (
                  <Button
                    variant="gradient"
                    size="sm"
                    disabled={pending || isClaimed || seatsLeft === 0}
                    onClick={() => onClaim(banner)}
                  >
                    {isClaimed ? "Claimed" : (banner.cta_text ?? `Claim ${bonus} USDG`)}
                  </Button>
                ) : bonus > 0 ? (
                  <Button asChild variant="gradient" size="sm">
                    <Link href="/register">{banner.cta_text ?? "Sign up to claim"}</Link>
                  </Button>
                ) : banner.link_url ? (
                  <Button asChild variant="glass" size="sm">
                    <Link href={banner.link_url}>{banner.cta_text ?? "Learn more"}</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
