import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpFromLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StaggerGrid, StaggerItem } from "@/components/shared/motion";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { CopyButton } from "@/components/shared/copy-button";
import { ReviewDialog } from "@/components/admin/review-dialog";
import { approveWithdrawal, rejectWithdrawal } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { DEFAULTS, NETWORKS } from "@/lib/constants";
import { cn, formatCurrency, truncateAddress } from "@/lib/utils";
import type { WithdrawRequest } from "@/types/database";

export const metadata: Metadata = { title: "Withdrawals · Admin" };
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

export default async function AdminWithdrawalsPage({ searchParams }: PageProps) {
  const { status = "pending", page: pageParam } = await searchParams;
  await requireAdmin();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const from = (page - 1) * DEFAULTS.PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase.from("withdraw_requests").select("*", { count: "exact" });
  if (status !== "all") query = query.eq("status", status);

  const { data, count } = await query
    .order("created_at", { ascending: status === "pending" })
    .range(from, from + DEFAULTS.PAGE_SIZE - 1);

  const requests = (data as WithdrawRequest[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULTS.PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Withdrawals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send the payout on-chain first, then approve with the transaction hash. Rejecting returns
          the full amount to the user&apos;s balance.
        </p>
      </header>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/withdrawals?status=${tab.value}`}
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
          icon={ArrowUpFromLine}
          title={status === "pending" ? "Nothing to review" : "No withdrawals here"}
          description={
            status === "pending"
              ? "All withdrawal requests have been processed."
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

                    <p className="text-xs text-muted-foreground">
                      Fee {formatCurrency(item.fee)} · send{" "}
                      <span className="font-mono font-medium text-foreground">
                        {formatCurrency(item.net_amount)} {item.asset}
                      </span>
                    </p>

                    <div className="flex items-center gap-2">
                      <p className="min-w-0 break-all font-mono text-xs">{item.wallet_address}</p>
                      <CopyButton value={item.wallet_address} label="Address" />
                    </div>

                    <dl className="grid gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2">
                      <Field label="User" value={truncateAddress(item.user_id, 8, 6)} mono />
                      <Field
                        label="Requested"
                        value={new Date(item.created_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      />
                      {item.tx_hash && (
                        <Field label="Payout tx" value={truncateAddress(item.tx_hash, 12, 8)} mono />
                      )}
                    </dl>

                    {item.admin_note && (
                      <p className="text-xs text-amber-300">Note: {item.admin_note}</p>
                    )}
                  </div>

                  {item.status === "pending" && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <ReviewDialog
                        action={approveWithdrawal}
                        requestId={item.id}
                        triggerLabel="Approve"
                        triggerVariant="gradient"
                        title="Approve withdrawal"
                        description="Only approve after the on-chain transfer has been sent."
                        confirmLabel="Mark as paid"
                        withTxHash
                        summary={
                          <>
                            <SummaryRow
                              label="Send"
                              value={`${formatCurrency(item.net_amount)} ${item.asset}`}
                            />
                            <SummaryRow label="To" value={item.wallet_address} mono />
                            <SummaryRow
                              label="Network"
                              value={
                                NETWORKS.find((n) => n.value === item.network)?.label ?? item.network
                              }
                            />
                          </>
                        }
                      />
                      <ReviewDialog
                        action={rejectWithdrawal}
                        requestId={item.id}
                        triggerLabel="Reject"
                        triggerVariant="destructive"
                        title="Reject withdrawal"
                        description="The full amount is returned to the user's available balance."
                        confirmLabel="Reject & refund"
                        noteLabel="Reason"
                        notePlaceholder="Explain why this withdrawal was declined."
                        noteRequired
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
              </StaggerItem>
            ))}
          </StaggerGrid>

          <Pagination
            page={page}
            totalPages={totalPages}
            baseHref={`/admin/withdrawals?status=${status}`}
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
