import type { Metadata } from "next";
import Link from "next/link";
import { TasksNav } from "@/components/admin/tasks-nav";
import { SubmissionQueue } from "@/components/admin/submission-queue";
import { Pagination } from "@/components/shared/pagination";
import { listTaskSubmissions } from "@/lib/queries";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { RequestStatus } from "@/types/database";

export const metadata: Metadata = { title: "Task submissions · Admin" };
export const dynamic = "force-dynamic";

const FILTERS: RequestStatus[] = ["pending", "approved", "rejected"];

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const status = (FILTERS as string[]).includes(params.status ?? "")
    ? (params.status as RequestStatus)
    : "pending";
  const page = Math.max(1, Number(params.page) || 1);

  const result = await listTaskSubmissions(status, page);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Task submissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Check each screenshot, then approve to credit the reward or reject with a reason.
        </p>
      </header>

      <TasksNav
        active="/admin/tasks/submissions"
        pending={status === "pending" ? result.total : 0}
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter}
            href={`/admin/tasks/submissions?status=${filter}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
              status === filter
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
            )}
          >
            {filter}
          </Link>
        ))}
      </div>

      <SubmissionQueue submissions={result.items} status={status} />

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        baseHref={`/admin/tasks/submissions?status=${status}`}
      />
    </div>
  );
}
