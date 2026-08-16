"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "framer-motion";
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

/** Groups render as one menu bar separated by hairlines — the review queues,
 *  which are the daily work, stay adjacent and one click deep. */
const GROUPS: AdminLink[][] = [
  [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  [
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
  [
    { href: "/admin/markets", label: "Markets", icon: Trophy },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/notifications", label: "Announcements", icon: Bell },
  ],
  [
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/logs", label: "Audit logs", icon: ScrollText },
  ],
];

export function AdminNav({ badges }: { badges: AdminBadges }) {
  const pathname = usePathname();

  function isActive(link: AdminLink) {
    return link.exact
      ? pathname === link.href
      : pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  return (
    <nav aria-label="Admin sections" className="mx-auto w-full max-w-7xl px-2 sm:px-4 lg:px-6">
      <div className="no-scrollbar flex items-stretch overflow-x-auto">
        {GROUPS.map((group, index) => (
          <Fragment key={group[0].href}>
            {index > 0 && (
              <span aria-hidden className="my-3.5 mx-1.5 w-px shrink-0 bg-border/70" />
            )}

            {group.map((link) => {
              const Icon = link.icon;
              const active = isActive(link);
              const count = link.badgeKey ? badges[link.badgeKey] : 0;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-12 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <>
                      <m.span
                        layoutId="admin-active-bg"
                        aria-hidden
                        className="absolute inset-x-1 bottom-0 top-1.5 rounded-t-lg bg-primary/10"
                        transition={{ type: "spring", stiffness: 400, damping: 34 }}
                      />
                      <m.span
                        layoutId="admin-active-underline"
                        aria-hidden
                        className="absolute inset-x-2 bottom-0 h-0.5 rounded-t-full bg-gradient-to-r from-primary to-accent"
                        transition={{ type: "spring", stiffness: 400, damping: 34 }}
                      />
                    </>
                  )}

                  <Icon className="relative size-4 shrink-0" />
                  <span className="relative whitespace-nowrap">{link.label}</span>

                  {count > 0 && (
                    <span className="relative grid min-w-5 place-items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-amber-400 ring-1 ring-inset ring-amber-500/25">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </Fragment>
        ))}
      </div>
    </nav>
  );
}
