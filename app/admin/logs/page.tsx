import Link from "next/link";
import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { DEFAULTS } from "@/lib/constants";
import { cn, truncateAddress } from "@/lib/utils";
import type { AdminLog } from "@/types/database";

export const metadata: Metadata = { title: "Audit logs · Admin" };
export const dynamic = "force-dynamic";

const ENTITIES = [
  { value: "all", label: "All" },
  { value: "deposit_request", label: "Deposits" },
  { value: "withdraw_request", label: "Withdrawals" },
  { value: "kyc_request", label: "KYC" },
  { value: "market", label: "Markets" },
  { value: "profile", label: "Users" },
  { value: "site_settings", label: "Settings" },
];

const TONE: Record<string, string> = {
  approve: "bg-emerald-500/15 text-emerald-300",
  resolve: "bg-emerald-500/15 text-emerald-300",
  reject: "bg-red-500/15 text-red-300",
  delete: "bg-red-500/15 text-red-300",
  ban: "bg-red-500/15 text-red-300",
  cancel: "bg-amber-500/15 text-amber-300",
  suspend: "bg-amber-500/15 text-amber-300",
};

function toneFor(action: string) {
  const match = Object.keys(TONE).find((key) => action.includes(key));
  return match ? TONE[match] : "bg-secondary text-muted-foreground";
}

interface PageProps {
  searchParams: Promise<{ entity?: string; page?: string }>;
}

export default async function AdminLogsPage({ searchParams }: PageProps) {
  const { entity = "all", page: pageParam } = await searchParams;
  await requireAdmin();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const from = (page - 1) * DEFAULTS.PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase.from("admin_logs").select("*", { count: "exact" });
  if (entity !== "all") query = query.eq("entity_type", entity);

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + DEFAULTS.PAGE_SIZE - 1);

  const logs = (data as AdminLog[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULTS.PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Audit logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every administrative action, newest first. {total.toLocaleString()} entr
          {total === 1 ? "y" : "ies"} recorded.
        </p>
      </header>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {ENTITIES.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/logs?entity=${tab.value}`}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              entity === tab.value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No entries"
          description="Administrative actions will be recorded here as they happen."
        />
      ) : (
        <>
          <div className="space-y-2">
            {logs.map((log) => (
              <Card key={log.id} className="glass">
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                        toneFor(log.action)
                      )}
                    >
                      {log.action}
                    </span>
                    <span className="text-xs text-muted-foreground">{log.entity_type}</span>
                    {log.entity_id && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {truncateAddress(log.entity_id, 8, 6)}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    By{" "}
                    <span className="font-mono">
                      {log.admin_id ? truncateAddress(log.admin_id, 8, 6) : "system"}
                    </span>
                    {log.ip_address && ` · ${log.ip_address}`}
                  </p>

                  {log.after_data && Object.keys(log.after_data).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Payload
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-secondary/40 p-3 font-mono text-[11px]">
                        {JSON.stringify(log.after_data, null, 2)}
                      </pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            baseHref={`/admin/logs?entity=${entity}`}
          />
        </>
      )}
    </div>
  );
}
