"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
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

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <Link href="/" className="min-w-0 shrink" aria-label={`${siteName ?? "NextGen Predict"} home`}>
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
                  <m.span
                    layoutId="site-nav-underline"
                    aria-hidden
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-primary to-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {account}

          <Button
            variant="ghost"
            size="icon"
            className="-me-1 size-9 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border/50 bg-background/95 md:hidden"
          >
            <div className="px-4 py-3">
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
          </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}
