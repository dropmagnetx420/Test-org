import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownToLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StaggerGrid, StaggerItem } from "@/components/shared/motion";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { ReviewDialog } from "@/components/admin/review-dialog";
import { FilePreviewLink } from "@/components/admin/file-preview-link";
import { approveDeposit, rejectDeposit } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { DEFAULTS, NETWORKS, STORAGE_BUCKETS } from "@/lib/constants";
import { cn, formatCurrency, truncateAddress } from "@/lib/utils";
import type { DepositRequest } from "@/types/database";

export const metadata: Metadata = { title: "Deposits · Admin" };
export const dynamic = "force-dynamic";

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminDepositsPage({ searchParams }: PageProps) {
  const { status = "pending", page: pageParam } = await searchParams;
  await requireAdmin();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const from = (page - 1) * DEFAULTS.PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase.from("deposit_requests").select("*", { count: "exact" });
  if (status !== "all") query = query.eq("status", status);

  const { data, count } = await query
    .order("created_at", { ascending: status === "pending" })
    .range(from, from + DEFAULTS.PAGE_SIZE - 1);

  const requests = (data as DepositRequest[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULTS.PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Deposits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify the transaction on-chain before approving. Approval credits the balance and applies
          any deposit bonus automatically.
        </p>
      </header>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/deposits?status=${tab.value}`}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              status === tab.value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={ArrowDownToLine}
          title={status === "pending" ? "Nothing to review" : "No deposits here"}
          description={
            status === "pending"
              ? "All deposit requests have been processed."
              : "Try a different filter."
          }
        />
      ) : (
        <>
          <StaggerGrid className="space-y-3">
            {requests.map((item) => (
              <StaggerItem key={item.id}>
              <Card className="glass lift">
                <CardContent className="flex flex-wrap items-start gap-4 p-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-lg font-semibold tabular-nums">
                        {formatCurrency(item.amount)} {item.asset}
                      </p>
                      <StatusBadge status={item.status} />
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {NETWORKS.find((n) => n.value === item.network)?.label ?? item.network}
                      </span>
                    </div>

                    <dl className="grid gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2">
                      <Field label="User" value={truncateAddress(item.user_id, 8, 6)} mono />
                      <Field label="Tx hash" value={truncateAddress(item.tx_hash, 12, 8)} mono />
                      <Field
                        label="To address"
                        value={truncateAddress(item.deposit_address, 10, 8)}
                        mono
                      />
                      <Field
                        label="Submitted"
                        value={new Date(item.created_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      />
                    </dl>

                    {item.admin_note && (
                      <p className="text-xs text-amber-300">Note: {item.admin_note}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {item.receipt_url && (
                      <FilePreviewLink
                        bucket={STORAGE_BUCKETS.RECEIPTS}
                        path={item.receipt_url}
                        label="Receipt"
                      />
                    )}

                    {item.status === "pending" && (
                      <>
                        <ReviewDialog
                          action={approveDeposit}
                          requestId={item.id}
                          triggerLabel="Approve"
                          triggerVariant="gradient"
                          title="Approve deposit"
                          description="This credits the user's balance immediately and cannot be undone."
                          confirmLabel="Approve & credit"
                          summary={
                            <>
                              <SummaryRow
                                label="Amount"
                                value={`${formatCurrency(item.amount)} ${item.asset}`}
                              />
                              <SummaryRow label="Tx hash" value={item.tx_hash} mono />
                              <SummaryRow label="To" value={item.deposit_address} mono />
                            </>
                          }
                        />
                        <ReviewDialog
                          action={rejectDeposit}
                          requestId={item.id}
                          triggerLabel="Reject"
                          triggerVariant="destructive"
                          title="Reject deposit"
                          description="The user is notified with your note. No balance is credited."
                          confirmLabel="Reject deposit"
                          noteLabel="Reason"
                          notePlaceholder="Explain why this deposit could not be verified."
                          noteRequired
                        />
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
              </StaggerItem>
            ))}
          </StaggerGrid>

          <Pagination
            page={page}
            totalPages={totalPages}
            baseHref={`/admin/deposits?status=${status}`}
          />
        </>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("truncate", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-all text-right", mono && "font-mono")}>{value}</span>
    </div>
  );
}
