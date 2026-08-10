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
import { cn } from "@/lib/utils";

export interface AdminBadges {
  deposits: number;
  withdrawals: number;
  kyc: number;
  tasks: number;
}

type BadgeKey = keyof AdminBadges;

interface AdminLink {
  href: string;
  label: string;
  icon: typeof Users;
  exact?: boolean;
  badgeKey?: BadgeKey;
}

/** Grouped so the review queues — the daily work — read as one block. */
const GROUPS: { heading: string; links: AdminLink[] }[] = [
  {
    heading: "Overview",
    links: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    heading: "Review queue",
    links: [
      { href: "/admin/deposits", label: "Deposits", icon: ArrowDownToLine, badgeKey: "deposits" },
      {
        href: "/admin/withdrawals",
        label: "Withdrawals",
        icon: ArrowUpFromLine,
        badgeKey: "withdrawals",
      },
      { href: "/admin/kyc", label: "KYC", icon: BadgeCheck, badgeKey: "kyc" },
      { href: "/admin/tasks", label: "Tasks", icon: Briefcase, badgeKey: "tasks" },
    ],
  },
  {
    heading: "Manage",
    links: [
      { href: "/admin/markets", label: "Markets", icon: Trophy },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/notifications", label: "Announcements", icon: Bell },
    ],
  },
  {
    heading: "System",
    links: [
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/logs", label: "Audit logs", icon: ScrollText },
    ],
  },
];

const ALL_LINKS = GROUPS.flatMap((group) => group.links);

export function AdminNav({ badges }: { badges: AdminBadges }) {
  const pathname = usePathname();

  function isActive(link: AdminLink) {
    return link.exact
      ? pathname === link.href
      : pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  function countFor(link: AdminLink) {
    return link.badgeKey ? badges[link.badgeKey] : 0;
  }

  return (
    <>
      <nav className="sticky top-20 hidden h-fit w-60 shrink-0 lg:block" aria-label="Admin">
        <div className="glass space-y-5 rounded-2xl p-3">
          {GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                {group.heading}
              </p>
              <div className="space-y-0.5">
                {group.links.map((link) => {
                  const Icon = link.icon;
                  const active = isActive(link);
                  const count = countFor(link);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary transition-opacity",
                          active ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{link.label}</span>
                      {count > 0 && (
                        <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-amber-400 ring-1 ring-inset ring-amber-500/25">
                          {count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden" aria-label="Admin">
        {ALL_LINKS.map((link) => {
          const Icon = link.icon;
          const active = isActive(link);
          const count = countFor(link);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/60 bg-card/60 text-muted-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {link.label}
              {count > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 font-mono text-[10px] tabular-nums text-amber-400">
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
