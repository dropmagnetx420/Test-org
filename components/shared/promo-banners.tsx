"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Gift, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { claimPromo } from "@/lib/actions/notifications";
import { cn, toNumber } from "@/lib/utils";
import type { PromoBanner } from "@/types/database";

const SLIDE_MS = 5000;
const SWIPE_PX = 50;

export function PromoBanners({
  banners,
  isAuthenticated,
}: {
  banners: PromoBanner[];
  isAuthenticated: boolean;
}) {
  const [hidden, setHidden] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [claimed, setClaimed] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const count = banners.length;

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, paused, count]);

  // A horizontal drag must not fire the link overlay it started on.
  const swipe = useRef({ x: 0, moved: false, active: false });

  function onPointerDown(event: React.PointerEvent) {
    swipe.current = { x: event.clientX, moved: false, active: true };
    setPaused(true);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!swipe.current.active) return;
    if (Math.abs(event.clientX - swipe.current.x) > 10) swipe.current.moved = true;
  }

  function onPointerUp(event: React.PointerEvent) {
    if (!swipe.current.active) return;
    const dx = event.clientX - swipe.current.x;
    swipe.current.active = false;
    setPaused(false);
    if (count < 2 || Math.abs(dx) < SWIPE_PX) return;
    setIndex((i) => (dx < 0 ? (i + 1) % count : (i - 1 + count) % count));
  }

  function onClickCapture(event: React.MouseEvent) {
    if (!swipe.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    swipe.current.moved = false;
  }

  if (hidden || count === 0) return null;

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
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="absolute right-2 top-2 z-30 rounded-md bg-black/30 p-1 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
        aria-label="Hide offers"
      >
        <X className="size-4" />
      </button>

      <div
        className="touch-pan-y overflow-hidden rounded-xl border border-border/60"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        <motion.div
          className="flex"
          animate={{ x: `-${index * 100}%` }}
          transition={{ type: "spring", stiffness: 260, damping: 32 }}
        >
          {banners.map((banner) => {
            const bonus = toNumber(banner.bonus_amount);
            const seatsLeft =
              banner.user_limit != null
                ? Math.max(0, banner.user_limit - banner.claimed_count)
                : null;
            const isClaimed = claimed.includes(banner.id);
            const isClaimable = bonus > 0 && isAuthenticated;

            return (
              <div
                key={banner.id}
                className={cn(
                  "relative h-28 w-full shrink-0 overflow-hidden sm:h-36",
                  banner.image_url
                    ? "bg-secondary"
                    : cn(
                        "bg-gradient-to-r",
                        banner.bg_gradient || "from-primary/20 via-violet-500/10 to-cyan-500/20"
                      )
                )}
              >
                {banner.image_url && (
                  <>
                    <Image
                      src={banner.image_url}
                      alt=""
                      fill
                      unoptimized
                      sizes="100vw"
                      className="select-none object-cover"
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/20" />
                  </>
                )}

                {banner.link_url && !isClaimable && (
                  <Link
                    href={banner.link_url}
                    className="absolute inset-0 z-10"
                    aria-label={banner.title}
                  />
                )}

                <div className="relative flex h-full items-center gap-3 px-4 pr-12 sm:gap-4 sm:px-6">
                  <div
                    className={cn(
                      "hidden size-11 shrink-0 place-items-center rounded-xl bg-white/10 sm:grid",
                      banner.image_url ? "text-white" : "text-primary"
                    )}
                  >
                    <Gift className="size-5" />
                  </div>

                  <div className={cn("min-w-0 flex-1", banner.image_url && "text-white")}>
                    <p className="truncate font-semibold sm:text-lg">{banner.title}</p>
                    {banner.subtitle && (
                      <p
                        className={cn(
                          "mt-0.5 line-clamp-2 text-xs sm:text-sm",
                          banner.image_url ? "text-white/75" : "text-muted-foreground"
                        )}
                      >
                        {banner.subtitle}
                      </p>
                    )}
                    {seatsLeft !== null && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-300">
                        <Sparkles className="size-3" />
                        {seatsLeft > 0 ? `${seatsLeft.toLocaleString()} spots left` : "Fully claimed"}
                      </p>
                    )}
                  </div>

                  <div className="relative z-20 shrink-0">
                    {isClaimable ? (
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
              </div>
            );
          })}
        </motion.div>
      </div>

      {count > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show offer ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-5 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
