import type { Metadata } from "next";
import { TasksNav } from "@/components/admin/tasks-nav";
import { TaskManager } from "@/components/admin/task-manager";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { EarnTask } from "@/types/database";

export const metadata: Metadata = { title: "Earn tasks · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminTasksPage() {
  await requireAdmin();

  const supabase = await createClient();
  const [tasks, pending] = await Promise.all([
    supabase
      .from("earn_tasks")
      .select("*")
      .order("position")
      .order("created_at", { ascending: false }),
    supabase
      .from("task_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Earn tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Social tasks users can complete for a wallet reward.
        </p>
      </header>

      <TasksNav active="/admin/tasks" pending={pending.count ?? 0} />
      <TaskManager tasks={(tasks.data as EarnTask[]) ?? []} />
    </div>
  );
}
