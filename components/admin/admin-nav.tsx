"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  Bell,
  Briefcase,
  LayoutDashboard,
  ScrollText,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/markets", label: "Markets", icon: Trophy },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/deposits", label: "Deposits", icon: ArrowDownToLine, badgeKey: "deposits" },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowUpFromLine, badgeKey: "withdrawals" },
  { href: "/admin/kyc", label: "KYC", icon: BadgeCheck, badgeKey: "kyc" },
  { href: "/admin/tasks", label: "Tasks", icon: Briefcase, badgeKey: "tasks" },
  { href: "/admin/notifications", label: "Announcements", icon: Bell },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/logs", label: "Audit logs", icon: ScrollText },
] as const;

export interface AdminBadges {
  deposits: number;
  withdrawals: number;
  kyc: number;
  tasks: number;
}

export function AdminNav({ badges }: { badges: AdminBadges }) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <nav className="sticky top-20 hidden h-fit w-56 shrink-0 space-y-1 lg:block">
        {LINKS.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href, "exact" in link ? link.exact : false);
          const count = "badgeKey" in link ? badges[link.badgeKey] : 0;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{link.label}</span>
              {count > 0 && (
                <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                  {count}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <nav className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
        {LINKS.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href, "exact" in link ? link.exact : false);
          const count = "badgeKey" in link ? badges[link.badgeKey] : 0;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/60 bg-card/60 text-muted-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {link.label}
              {count > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-400">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
