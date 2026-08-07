"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, ExternalLink, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilePreviewLink } from "@/components/admin/file-preview-link";
import { reviewTaskSubmission } from "@/lib/actions/admin";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import type { ActionResult, TaskSubmissionWithRelations } from "@/types/database";

type Decision = { submission: TaskSubmissionWithRelations; approve: boolean };

export function SubmissionQueue({
  submissions,
  status,
}: {
  submissions: TaskSubmissionWithRelations[];
  status: string;
}) {
  const [decision, setDecision] = useState<Decision | null>(null);

  if (submissions.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={status === "pending" ? "Nothing to review" : `No ${status} submissions`}
        description={
          status === "pending"
            ? "Task proofs land here as soon as users submit them."
            : "Try a different filter to see other submissions."
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {submissions.map((submission) => (
        <SubmissionRow
          key={submission.id}
          submission={submission}
          onDecide={(approve) => setDecision({ submission, approve })}
        />
      ))}

      <ReviewDialog
        key={decision ? `${decision.submission.id}-${decision.approve}` : "closed"}
        decision={decision}
        onDone={() => setDecision(null)}
      />
    </div>
  );
}

function SubmissionRow({
  submission,
  onDecide,
}: {
  submission: TaskSubmissionWithRelations;
  onDecide: (approve: boolean) => void;
}) {
  const isPending = submission.status === "pending";

  return (
    <Card className="glass">
      <CardContent className="flex flex-wrap items-start gap-4 p-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold">
              {submission.task?.title ?? "Deleted task"}
            </p>
            <StatusBadge status={submission.status} />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span className="truncate">
              {submission.user?.username ?? submission.user?.email ?? "Unknown user"}
            </span>
            <span>
              Reward{" "}
              <span className="font-mono text-foreground">
                {formatCurrency(submission.reward)} USDG
              </span>
            </span>
            <span>
              {new Date(submission.created_at).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>

          {submission.proof_note && (
            <p className="rounded-lg bg-secondary/40 p-2 text-xs text-muted-foreground">
              {submission.proof_note}
            </p>
          )}

          {submission.admin_note && !isPending && (
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground">Note:</span> {submission.admin_note}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {submission.proof_url && (
              <FilePreviewLink
                bucket={STORAGE_BUCKETS.TASK_PROOFS}
                path={submission.proof_url}
                label="View screenshot"
              />
            )}
            {submission.task?.target_url && (
              <a
                href={submission.task.target_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3" />
                Open target
              </a>
            )}
          </div>
        </div>

        {isPending && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDecide(false)}
              className="text-red-400 hover:text-red-300"
            >
              Reject
            </Button>
            <Button variant="gradient" size="sm" onClick={() => onDecide(true)}>
              <CheckCheck className="size-4" />
              Approve
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewDialog({ decision, onDone }: { decision: Decision | null; onDone: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    reviewTaskSubmission,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Saved.");
      onDone();
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router, onDone]);

  const approve = decision?.approve ?? false;

  return (
    <Dialog open={decision !== null} onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{approve ? "Approve submission" : "Reject submission"}</DialogTitle>
          <DialogDescription>
            {approve
              ? `Credits ${formatCurrency(decision?.submission.reward ?? 0)} USDG to the user's wallet.`
              : "The user keeps no reward and is notified with your note."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="submissionId" value={decision?.submission.id ?? ""} />
          <input type="hidden" name="approve" value={approve ? "true" : "false"} />

          <div className="space-y-2">
            <Label htmlFor="review-note">
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="review-note"
              name="note"
              rows={3}
              maxLength={500}
              placeholder={approve ? "Nice work!" : "The screenshot did not show a follow."}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <SubmitButton
              variant={approve ? "gradient" : "destructive"}
              size="sm"
              pendingText="Saving…"
            >
              {approve ? "Approve and pay" : "Reject"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
