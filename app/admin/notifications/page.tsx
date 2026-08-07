import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { AnnouncementForm } from "@/components/admin/announcement-form";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Notification } from "@/types/database";

export const metadata: Metadata = { title: "Announcements · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  await requireAdmin();

  const supabase = await createClient();
  const [{ count }, { data }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("notifications")
      .select("*")
      .eq("type", "announcement")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const sent = (data as Notification[]) ?? [];

  /** One row exists per recipient, so collapse the fan-out back into a single entry per send. */
  const unique = Array.from(
    sent
      .reduce((acc, item) => {
        const key = `${item.title}|${item.created_at.slice(0, 16)}`;
        const existing = acc.get(key);
        if (existing) existing.count += 1;
        else acc.set(key, { item, count: 1 });
        return acc;
      }, new Map<string, { item: Notification; count: number }>())
      .values()
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Announcements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Broadcast a notification to every active user at once.
        </p>
      </header>

      <AnnouncementForm recipients={count ?? 0} />

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Recently sent</CardTitle>
        </CardHeader>
        <CardContent>
          {unique.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Nothing sent yet"
              description="Announcements you send will be listed here."
            />
          ) : (
            <div className="space-y-3">
              {unique.map(({ item, count: recipients }) => (
                <div
                  key={item.id}
                  className="space-y-1 border-b border-border/40 pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {recipients.toLocaleString()} recipient{recipients === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
