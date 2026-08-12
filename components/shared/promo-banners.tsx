"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Gift, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { claimPromo } from "@/lib/actions/notifications";
import { cn, toNumber } from "@/lib/utils";
import type { PromoBanner } from "@/types/database";

const SLIDE_MS = 6000;
const SWIPE_PX = 50;
/** Caps on the card's lean, in degrees. Past ~10deg the text starts to skew. */
const DRAG_TILT = 10;
const HOVER_TILT_Y = 7;
const HOVER_TILT_X = 4;

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

  /**
   * The tilt is written straight to the node: a pointermove that went through
   * state would re-render every slide on each frame of a swipe.
   */
  const cardRef = useRef<HTMLDivElement>(null);
  const stillRef = useRef(false);
  const hoverRef = useRef(false);

  useEffect(() => {
    stillRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /**
     * Touch browsers synthesize a mouse event burst after a tap, and no
     * mouseleave ever follows it. Taking those would leave the card tilted and
     * the autoplay paused for good, so hover behaviour is mice only.
     */
    hoverRef.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  const tilt = useCallback((x: number, y: number, animated = true) => {
    const card = cardRef.current;
    if (!card || stillRef.current) return;
    card.style.transition = animated ? "" : "none";
    card.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;
  }, []);

  // A horizontal drag must not fire the link overlay it started on.
  const swipe = useRef({ x: 0, moved: false, active: false });

  function onPointerDown(event: React.PointerEvent) {
    swipe.current = { x: event.clientX, moved: false, active: true };
    setPaused(true);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!swipe.current.active) return;
    const dx = event.clientX - swipe.current.x;
    if (Math.abs(dx) > 10) swipe.current.moved = true;
    // Leaning into the drag is what makes a swipe feel like turning a card.
    tilt(0, Math.max(-DRAG_TILT, Math.min(DRAG_TILT, dx / 12)), false);
  }

  function onPointerUp(event: React.PointerEvent) {
    if (!swipe.current.active) return;
    const dx = event.clientX - swipe.current.x;
    swipe.current.active = false;
    setPaused(false);
    tilt(0, 0);
    if (count < 2 || Math.abs(dx) < SWIPE_PX) return;
    setIndex((i) => (dx < 0 ? (i + 1) % count : (i - 1 + count) % count));
  }

  function onClickCapture(event: React.MouseEvent) {
    if (!swipe.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    swipe.current.moved = false;
  }

  /** Pointer-follow tilt for mice. Touch drags are handled by the swipe above. */
  function onHoverMove(event: React.MouseEvent<HTMLElement>) {
    if (!hoverRef.current || swipe.current.active) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    tilt(-py * HOVER_TILT_X * 2, px * HOVER_TILT_Y * 2, false);
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

  const step = (delta: number) => setIndex((i) => (i + delta + count) % count);

  return (
    <section
      aria-label="Promotions"
      aria-roledescription="carousel"
      className="group/promo promo-stage relative"
      onMouseEnter={() => {
        if (hoverRef.current) setPaused(true);
      }}
      onMouseLeave={() => {
        if (!hoverRef.current) return;
        setPaused(false);
        tilt(0, 0);
      }}
      onMouseMove={onHoverMove}
    >
      <div ref={cardRef} className="promo-card relative">
        {/* Cast shadow on the "floor". Set back in Z so the tilt parallaxes it. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-8 -bottom-3 h-8 rounded-[50%] bg-primary/40 blur-2xl [transform:translateZ(-80px)]"
        />

        <div className="promo-edge border-gradient sheen relative overflow-hidden rounded-2xl bg-card/40 backdrop-blur-xl">
          <div
            className="select-none touch-pan-y"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClickCapture={onClickCapture}
          >
            <div
              className="flex items-stretch transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
            >
              {banners.map((banner, i) => (
                <Slide
                  key={banner.id}
                  banner={banner}
                  eager={i === 0}
                  active={i === index}
                  isAuthenticated={isAuthenticated}
                  isClaimed={claimed.includes(banner.id)}
                  pending={pending}
                  onClaim={onClaim}
                />
              ))}
            </div>
          </div>

          {/* Glass highlight along the top lip, above the artwork. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/12 to-transparent"
          />

          <button
            type="button"
            onClick={() => setHidden(true)}
            aria-label="Hide offers"
            className="absolute end-2 top-2 z-30 grid size-9 place-items-center rounded-full bg-black/40 text-white/75 backdrop-blur-md transition-colors hover:bg-black/65 hover:text-white"
          >
            <X className="size-4" />
          </button>

          {count > 1 && (
            <>
              <CarouselArrow side="start" onClick={() => step(-1)} />
              <CarouselArrow side="end" onClick={() => step(1)} />
            </>
          )}
        </div>
      </div>

      {count > 1 && (
        <div className="mt-3 flex justify-center gap-1">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show offer ${i + 1} of ${count}`}
              aria-current={i === index}
              className="grid size-7 place-items-center"
            >
              <span
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index
                    ? "w-6 bg-gradient-to-r from-violet-500 to-cyan-400"
                    : "w-1.5 bg-border"
                )}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CarouselArrow({ side, onClick }: { side: "start" | "end"; onClick: () => void }) {
  const Icon = side === "start" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "start" ? "Previous offer" : "Next offer"}
      className={cn(
        // Touch devices swipe instead; showing arrows there would crowd the card.
        "absolute top-1/2 z-30 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white/80 opacity-0 backdrop-blur-md transition-all hover:bg-black/60 hover:text-white focus-visible:opacity-100 group-hover/promo:opacity-100 lg:grid",
        side === "start" ? "start-2" : "end-2"
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function Slide({
  banner,
  eager,
  active,
  isAuthenticated,
  isClaimed,
  pending,
  onClaim,
}: {
  banner: PromoBanner;
  eager: boolean;
  active: boolean;
  isAuthenticated: boolean;
  isClaimed: boolean;
  pending: boolean;
  onClaim: (banner: PromoBanner) => void;
}) {
  const bonus = toNumber(banner.bonus_amount);
  const seatsLeft =
    banner.user_limit != null ? Math.max(0, banner.user_limit - banner.claimed_count) : null;
  const soldOut = seatsLeft === 0;
  const isClaimable = bonus > 0 && isAuthenticated;
  const takenPct =
    banner.user_limit && banner.user_limit > 0
      ? Math.min(100, Math.round((banner.claimed_count / banner.user_limit) * 100))
      : null;
  const onImage = Boolean(banner.image_url);

  return (
    <article
      aria-hidden={!active}
      // Without this the CTA and link overlay of every off-screen slide stay in
      // the tab order, so keyboard focus disappears into the cropped ones.
      inert={!active}
      aria-label={banner.title}
      // Off-screen slides hang back, so a swipe brings the next one forward.
      style={active ? undefined : { transform: "scale(0.92)", opacity: 0.45 }}
      className={cn(
        "relative grid w-full shrink-0 overflow-hidden",
        "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        onImage
          ? "bg-secondary"
          : cn(
              "bg-gradient-to-br",
              banner.bg_gradient || "from-violet-600/25 via-fuchsia-600/10 to-cyan-500/25"
            )
      )}
    >
      {/**
       * The slide takes its height from its width, so artwork keeps its shape at
       * every screen size instead of being cropped into a thin strip on a phone.
       * The sizer shares one grid cell with the copy, so a long title on a narrow
       * phone can still push the card taller rather than being clipped by it.
       */}
      <div
        aria-hidden
        className="col-start-1 row-start-1 aspect-[16/10] sm:aspect-[21/9] lg:aspect-[1000/260]"
      />

      {banner.image_url && (
        <>
          <Image
            src={banner.image_url}
            alt=""
            fill
            quality={82}
            loading={eager ? "eager" : "lazy"}
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="select-none object-cover"
            draggable={false}
          />
          {/* Copy sits at the bottom on phones and to the left on wide screens,
              so the scrim has to follow it. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/10 sm:bg-gradient-to-r sm:from-black/85 sm:via-black/45 sm:to-transparent" />
        </>
      )}

      {banner.link_url && !isClaimable && (
        <Link href={banner.link_url} className="absolute inset-0 z-10" aria-label={banner.title} />
      )}

      <div
        className={cn(
          "col-start-1 row-start-1 relative flex flex-col gap-2.5 p-4 pe-12 sm:flex-row sm:items-center sm:gap-5 sm:p-6 sm:pe-14",
          onImage ? "justify-end text-white" : "justify-center"
        )}
      >
        <div
          className={cn(
            "hidden size-12 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-inner backdrop-blur-sm sm:grid",
            onImage ? "text-white" : "text-primary"
          )}
        >
          <Gift className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-pretty text-base font-bold leading-snug tracking-tight sm:text-xl lg:text-2xl">
            {banner.title}
          </h3>

          {banner.subtitle && (
            <p
              className={cn(
                "mt-1 line-clamp-2 text-pretty text-xs leading-relaxed sm:text-sm",
                onImage ? "text-white/80" : "text-muted-foreground"
              )}
            >
              {banner.subtitle}
            </p>
          )}

          {seatsLeft !== null && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  soldOut
                    ? "border-white/15 bg-white/10 text-muted-foreground"
                    : "border-amber-400/30 bg-amber-400/15 text-amber-300"
                )}
              >
                <Sparkles className="size-3" />
                {soldOut ? "Fully claimed" : `${seatsLeft.toLocaleString()} spots left`}
              </span>

              {takenPct !== null && !soldOut && (
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/15">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                    style={{ width: `${takenPct}%` }}
                  />
                </span>
              )}
            </div>
          )}
        </div>

        <div className="relative z-20 shrink-0">
          {isClaimable ? (
            <Button
              variant="gradient"
              disabled={pending || isClaimed || soldOut}
              onClick={() => onClaim(banner)}
              className="w-full sm:w-auto"
            >
              {isClaimed ? "Claimed" : (banner.cta_text ?? `Claim ${bonus} USDG`)}
            </Button>
          ) : bonus > 0 ? (
            <Button asChild variant="gradient" className="w-full sm:w-auto">
              <Link href="/register">{banner.cta_text ?? "Sign up to claim"}</Link>
            </Button>
          ) : banner.link_url ? (
            <Button asChild variant="glass" className="w-full sm:w-auto">
              <Link href={banner.link_url}>{banner.cta_text ?? "Learn more"}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
