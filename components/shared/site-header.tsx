"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { SPORTS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/markets", label: "Markets" },
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
  logoUrl,
}: {
  account: ReactNode;
  mobileAuth?: ReactNode;
  siteName?: string;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0" aria-label={`${siteName ?? "NextGen Predict"} home`}>
          <Logo logoUrl={logoUrl} siteName={siteName} />
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground",
                pathname === item.href.split("?")[0] && "text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
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
