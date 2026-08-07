import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { NotificationList } from "@/components/dashboard/notification-list";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { DEFAULTS } from "@/lib/constants";
import type { Notification } from "@/types/database";

export const metadata: Metadata = { title: "Notifications" };

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const profile = await requireProfile();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const from = (page - 1) * DEFAULTS.PAGE_SIZE;

  const supabase = await createClient();
  const [{ data, count }, unread] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .or(`user_id.eq.${profile.id},is_broadcast.eq.true`)
      .order("created_at", { ascending: false })
      .range(from, from + DEFAULTS.PAGE_SIZE - 1),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false),
  ]);

  const notifications = (data as Notification[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULTS.PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {(unread.count ?? 0) > 0
            ? `${unread.count} unread of ${total.toLocaleString()}`
            : `${total.toLocaleString()} notification${total === 1 ? "" : "s"}`}
        </p>
      </header>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing here yet"
          description="You'll be notified when deposits clear, markets settle, and offers go live."
          actionLabel="Browse markets"
          actionHref="/markets"
        />
      ) : (
        <>
          <NotificationList notifications={notifications} unreadCount={unread.count ?? 0} />
          <Pagination page={page} totalPages={totalPages} baseHref="/dashboard/notifications" />
        </>
      )}
    </div>
  );
}
