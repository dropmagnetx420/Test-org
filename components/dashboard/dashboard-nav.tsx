"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  BadgeCheck,
  Briefcase,
  Gift,
  LayoutDashboard,
  Receipt,
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
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/wallet/deposit", label: "Deposit", icon: ArrowDownToLine },
  { href: "/wallet/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
  { href: "/dashboard/transactions", label: "Transactions", icon: Receipt },
  { href: "/dashboard/bonuses", label: "Bonuses", icon: Gift },
  { href: "/earn", label: "Earn", icon: Briefcase },
  { href: "/referrals", label: "Referrals", icon: Users },
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

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && (
                <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
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

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/60 bg-card/60 text-muted-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {label}
              {badge && (
                <span className="grid size-4 place-items-center rounded-full bg-red-500 text-[9px] font-bold text-white">
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
