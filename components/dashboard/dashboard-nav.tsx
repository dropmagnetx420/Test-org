"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  BadgeCheck,
  Gift,
  HandCoins,
  LayoutDashboard,
  Receipt,
  Trophy,
  TrendingUp,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/predictions", label: "Predictions", icon: TrendingUp },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/earn", label: "Earn rewards", icon: HandCoins, accent: true },
  { href: "/referrals", label: "Referrals", icon: Users },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/wallet/deposit", label: "Deposit", icon: ArrowDownToLine },
  { href: "/wallet/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
  { href: "/dashboard/transactions", label: "Transactions", icon: Receipt },
  { href: "/dashboard/bonuses", label: "Bonuses", icon: Gift },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell, badgeKey: "unread" },
  { href: "/kyc", label: "Verification", icon: BadgeCheck },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function DashboardNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="sticky top-20 hidden h-fit w-56 shrink-0 space-y-1 lg:block">
        {LINKS.map(({ href, label, icon: Icon, ...rest }) => {
          const active = pathname === href;
          const badge = "badgeKey" in rest && unreadCount > 0;
          const accent = "accent" in rest;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "text-primary"
                  : accent
                    ? "border border-amber-500/30 bg-amber-500/[0.08] text-amber-300 hover:bg-amber-500/15"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              {active && (
                <m.span
                  layoutId="dash-active-desktop"
                  aria-hidden
                  className="absolute inset-0 rounded-lg bg-primary/15 ring-1 ring-inset ring-primary/25"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <Icon className="relative size-4 shrink-0" />
              <span className="relative flex-1">{label}</span>
              {badge && (
                <Badge variant="destructive" className="relative px-1.5 py-0 text-[10px]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Mobile horizontal scroller */}
      <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:hidden">
        {LINKS.map(({ href, label, icon: Icon, ...rest }) => {
          const active = pathname === href;
          const badge = "badgeKey" in rest && unreadCount > 0;
          const accent = "accent" in rest;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : accent
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-border/60 bg-card/60 text-muted-foreground"
              )}
            >
              {active && (
                <m.span
                  layoutId="dash-active-mobile"
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-primary/15"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <Icon className="relative size-3.5" />
              <span className="relative">{label}</span>
              {badge && (
                <span className="relative grid size-4 place-items-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
