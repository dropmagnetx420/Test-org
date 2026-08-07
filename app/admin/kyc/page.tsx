import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { ReviewDialog } from "@/components/admin/review-dialog";
import { FilePreviewLink } from "@/components/admin/file-preview-link";
import { reviewKyc } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { DEFAULTS, STORAGE_BUCKETS } from "@/lib/constants";
import { cn, truncateAddress } from "@/lib/utils";
import type { KycRequest } from "@/types/database";

export const metadata: Metadata = { title: "KYC · Admin" };
export const dynamic = "force-dynamic";

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const DOC_LABELS: Record<string, string> = {
  national_id: "National ID",
  passport: "Passport",
  driving_license: "Driving license",
};

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminKycPage({ searchParams }: PageProps) {
  const { status = "pending", page: pageParam } = await searchParams;
  await requireAdmin();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const from = (page - 1) * DEFAULTS.PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase.from("kyc_requests").select("*", { count: "exact" });
  if (status !== "all") query = query.eq("status", status);

  const { data, count } = await query
    .order("created_at", { ascending: status === "pending" })
    .range(from, from + DEFAULTS.PAGE_SIZE - 1);

  const requests = (data as KycRequest[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULTS.PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Identity verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Check that the selfie matches the document and the details line up. Approving grants the
          verified badge and unlocks withdrawals.
        </p>
      </header>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/kyc?status=${tab.value}`}
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
          icon={BadgeCheck}
          title={status === "pending" ? "Nothing to review" : "No submissions here"}
          description={
            status === "pending"
              ? "All verification requests have been processed."
              : "Try a different filter."
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {requests.map((item) => (
              <Card key={item.id} className="glass">
                <CardContent className="flex flex-wrap items-start gap-4 p-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold">{item.full_name}</p>
                      <StatusBadge status={item.status} />
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {DOC_LABELS[item.document_type] ?? item.document_type}
                      </span>
                    </div>

                    <dl className="grid gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2">
                      <Field label="Document no." value={item.document_number} mono />
                      <Field label="Country" value={item.country} />
                      <Field label="Date of birth" value={item.date_of_birth ?? "—"} />
                      <Field label="User" value={truncateAddress(item.user_id, 8, 6)} mono />
                      {item.address && <Field label="Address" value={item.address} />}
                      <Field
                        label="Submitted"
                        value={new Date(item.created_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      />
                    </dl>

                    <div className="flex flex-wrap gap-2">
                      <FilePreviewLink
                        bucket={STORAGE_BUCKETS.KYC}
                        path={item.document_front_url}
                        label="Document front"
                      />
                      {item.document_back_url && (
                        <FilePreviewLink
                          bucket={STORAGE_BUCKETS.KYC}
                          path={item.document_back_url}
                          label="Document back"
                        />
                      )}
                      <FilePreviewLink
                        bucket={STORAGE_BUCKETS.KYC}
                        path={item.selfie_url}
                        label="Selfie"
                      />
                    </div>

                    {item.admin_note && (
                      <p className="text-xs text-amber-300">Note: {item.admin_note}</p>
                    )}
                  </div>

                  {item.status === "pending" && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <ReviewDialog
                        action={reviewKyc}
                        requestId={item.id}
                        approve
                        triggerLabel="Approve"
                        triggerVariant="gradient"
                        title="Approve verification"
                        description="The user gets a verified badge and withdrawals unlock."
                        confirmLabel="Approve identity"
                        summary={
                          <>
                            <SummaryRow label="Name" value={item.full_name} />
                            <SummaryRow
                              label="Document"
                              value={DOC_LABELS[item.document_type] ?? item.document_type}
                            />
                            <SummaryRow label="Number" value={item.document_number} mono />
                          </>
                        }
                      />
                      <ReviewDialog
                        action={reviewKyc}
                        requestId={item.id}
                        approve={false}
                        triggerLabel="Reject"
                        triggerVariant="destructive"
                        title="Reject verification"
                        description="The user is notified with your reason and can resubmit."
                        confirmLabel="Reject submission"
                        noteLabel="Reason"
                        notePlaceholder="e.g. Document photo is blurry — please resubmit."
                        noteRequired
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} baseHref={`/admin/kyc?status=${status}`} />
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
