"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { SPORTS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Sport links share the `/markets` pathname, so only the first entry can own
 *  the active state — the rest are plain shortcuts. */
const NAV = [
  { href: "/markets", label: "Markets", match: "/markets" },
  { href: "/markets?sport=football", label: "Football" },
  { href: "/markets?sport=cricket", label: "Cricket" },
  { href: "/markets?sport=esports", label: "Esports" },
];

/**
 * Floating-capsule header: the bar hovers as a rounded glass slab instead of a
 * full-bleed strip, with a copper accent line that echoes the brand seal.
 *
 * `account` and `mobileAuth` are server-rendered slots so this shell can paint
 * before the caller's auth lookup resolves.
 */
export function SiteHeader({
  account,
  mobileAuth,
  siteName,
}: {
  account: ReactNode;
  mobileAuth?: ReactNode;
  siteName?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState(false);

  // The capsule tightens and gains depth once content scrolls under it.
  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 px-2 pt-2 sm:px-4 sm:pt-3">
      <div
        className={cn(
          "relative mx-auto max-w-7xl overflow-hidden rounded-2xl border transition-all duration-300",
          lifted
            ? "border-amber-500/25 bg-background/90 shadow-3d-gold backdrop-blur-2xl"
            : "border-border/50 bg-background/70 backdrop-blur-xl"
        )}
      >
        {/* Copper accent line — the header's signature, matched to the seal. */}
        <span
          aria-hidden
          className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent"
        />

        <div className="flex h-14 items-center gap-3 px-3 sm:h-16 sm:gap-4 sm:px-5">
          <Link href="/" className="shrink-0" aria-label={`${siteName ?? "NextGen Predict"} home`}>
            <Logo siteName={siteName} />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            <div className="flex items-center gap-0.5 rounded-full border border-border/60 bg-secondary/40 p-1">
              {NAV.map((item) => {
                const active = item.match ? pathname.startsWith(item.match) : false;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-gradient-to-r from-amber-500/25 to-primary/25 text-foreground shadow-[0_1px_6px_-1px_rgba(217,119,6,0.5)]"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <EarnPill />
            {account}

            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
              aria-expanded={open}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {open && (
          <div className="border-t border-border/50 bg-background/95 px-4 py-3 md:hidden">
            <Link
              href="/earn"
              onClick={() => setOpen(false)}
              className="mb-2 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-amber-600/5 px-3 py-3 text-sm font-semibold text-amber-300 shadow-3d-gold"
            >
              <span className="grid size-7 place-items-center rounded-full bg-amber-400/20">
                <Coins className="size-4" />
              </span>
              Earn free rewards
              <span className="ml-auto text-[11px] font-medium text-amber-300/70">
                Tasks &amp; ads
              </span>
            </Link>

            <Link
              href="/markets"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary/60"
            >
              All markets
            </Link>
            {SPORTS.map((sport) => (
              <Link
                key={sport.value}
                href={`/markets?sport=${sport.value}`}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              >
                <span className="mr-2">{sport.icon}</span>
                {sport.label}
              </Link>
            ))}
            {mobileAuth}
          </div>
        )}
      </div>
    </header>
  );
}

/** Kept in the bar on every breakpoint — the earn flow was previously buried
 *  eight items down the dashboard sidebar. */
function EarnPill() {
  return (
    <Link
      href="/earn"
      className="sheen relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full border border-amber-500/50 bg-gradient-to-r from-amber-500/20 to-orange-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-300 shadow-[0_2px_10px_-2px_rgba(217,119,6,0.5)] transition-all hover:border-amber-400/80 hover:text-amber-200 hover:shadow-[0_2px_16px_-2px_rgba(217,119,6,0.7)] sm:px-3"
    >
      <Coins className="size-3.5" />
      Earn
      <span className="hidden rounded-full bg-amber-400/25 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide lg:inline">
        free
      </span>
    </Link>
  );
}
