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

  // The bar starts flush with the page and gains its edge once content passes
  // under it, so the top of every page reads as one uninterrupted surface.
  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        lifted
          ? "border-border/60 bg-background/85 shadow-[0_1px_30px_-12px_hsl(var(--primary)/0.45)] backdrop-blur-2xl"
          : "border-transparent bg-background/60 backdrop-blur-xl"
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0" aria-label={`${siteName ?? "NextGen Predict"} home`}>
          <Logo siteName={siteName} />
        </Link>

        <nav className="hidden flex-1 items-center gap-0.5 md:flex">
          {NAV.map((item) => {
            const active = item.match ? pathname.startsWith(item.match) : false;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-primary to-accent"
                  />
                )}
              </Link>
            );
          })}
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
            className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm font-semibold text-amber-300"
          >
            <Coins className="size-4" />
            Earn rewards
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
    </header>
  );
}

/** Kept in the bar on every breakpoint — the earn flow was previously buried
 *  eight items down the dashboard sidebar. */
function EarnPill() {
  return (
    <Link
      href="/earn"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-primary/15 px-2.5 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:border-amber-400/70 hover:text-amber-200 sm:px-3"
    >
      <Coins className="size-3.5" />
      Earn
      <span className="hidden rounded-full bg-amber-400/20 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide lg:inline">
        free
      </span>
    </Link>
  );
}
