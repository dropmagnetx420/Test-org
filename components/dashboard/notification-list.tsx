"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Gift,
  Megaphone,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types/database";

const ICONS: Record<NotificationType, { icon: typeof Bell; tone: string }> = {
  deposit_approved: { icon: Wallet, tone: "text-emerald-400 bg-emerald-500/10" },
  deposit_rejected: { icon: Wallet, tone: "text-rose-400 bg-rose-500/10" },
  withdrawal_approved: { icon: Wallet, tone: "text-emerald-400 bg-emerald-500/10" },
  withdrawal_rejected: { icon: Wallet, tone: "text-rose-400 bg-rose-500/10" },
  prediction_won: { icon: TrendingUp, tone: "text-emerald-400 bg-emerald-500/10" },
  prediction_lost: { icon: TrendingDown, tone: "text-rose-400 bg-rose-500/10" },
  prediction_refunded: { icon: TrendingUp, tone: "text-cyan-400 bg-cyan-500/10" },
  kyc_approved: { icon: ShieldCheck, tone: "text-emerald-400 bg-emerald-500/10" },
  kyc_rejected: { icon: ShieldCheck, tone: "text-rose-400 bg-rose-500/10" },
  bonus_credited: { icon: Gift, tone: "text-cyan-400 bg-cyan-500/10" },
  referral_earned: { icon: Users, tone: "text-violet-400 bg-violet-500/10" },
  announcement: { icon: Megaphone, tone: "text-amber-400 bg-amber-500/10" },
  task_approved: { icon: CheckCheck, tone: "text-emerald-400 bg-emerald-500/10" },
  task_rejected: { icon: CheckCheck, tone: "text-rose-400 bg-rose-500/10" },
};

export function NotificationList({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function markAll() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.success) {
        toast.success(result.message ?? "All notifications marked as read.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not update notifications.");
      }
    });
  }

  function markOne(id: string) {
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={markAll} disabled={pending}>
            <CheckCheck className="size-4" />
            Mark all as read
          </Button>
        </div>
      )}

      <ul className="space-y-2">
        {notifications.map((item) => {
          const meta = ICONS[item.type] ?? { icon: Bell, tone: "text-primary bg-primary/10" };
          const Icon = meta.icon;

          const body = (
            <div
              className={cn(
                "flex gap-3 rounded-xl border p-4 transition-colors",
                item.is_read
                  ? "border-border/60 bg-card/40"
                  : "border-primary/30 bg-primary/5 hover:border-primary/50"
              )}
            >
              <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", meta.tone)}>
                <Icon className="size-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  {!item.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.message}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(item.created_at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>
          );

          return (
            <li key={item.id}>
              {item.link ? (
                <Link
                  href={item.link}
                  onClick={() => !item.is_read && markOne(item.id)}
                  className="block"
                >
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => !item.is_read && markOne(item.id)}
                  className="block w-full text-left"
                  disabled={item.is_read}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
