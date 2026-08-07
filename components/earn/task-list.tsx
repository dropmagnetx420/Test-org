"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Check, ExternalLink, Loader2, Upload } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { submitTaskProof, uploadTaskProof } from "@/lib/actions/earn";
import { EARN_TASK_TYPES } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";
import type { ActionResult, EarnTaskWithState } from "@/types/database";

function typeIcon(value: string) {
  return EARN_TASK_TYPES.find((t) => t.value === value)?.icon ?? "⭐";
}

export function TaskList({ tasks }: { tasks: EarnTaskWithState[] }) {
  const [active, setActive] = useState<EarnTaskWithState | null>(null);

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No tasks right now"
        description="Check back soon — new ways to earn are added regularly."
      />
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onStart={() => setActive(task)} />
      ))}

      <SubmitDialog
        key={active?.id ?? "closed"}
        task={active}
        onDone={() => setActive(null)}
      />
    </div>
  );
}

function TaskCard({ task, onStart }: { task: EarnTaskWithState; onStart: () => void }) {
  const status = task.submission?.status;
  const done = status === "approved" && !task.is_repeatable;
  const pending = status === "pending";

  return (
    <Card className={cn("glass", done && "opacity-70")}>
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-xl">
          {typeIcon(task.type)}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{task.title}</p>
            {status && <StatusBadge status={status} />}
          </div>
          {task.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
          )}
          {status === "rejected" && task.submission?.admin_note && (
            <p className="text-xs text-red-400">{task.submission.admin_note}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-sm font-semibold text-emerald-400">
            +{formatCurrency(task.reward)}
          </span>
          {done ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Check className="size-4" />
              Done
            </span>
          ) : (
            <Button variant="gradient" size="sm" onClick={onStart} disabled={pending}>
              {pending ? "In review" : "Start"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SubmitDialog({ task, onDone }: { task: EarnTaskWithState | null; onDone: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(submitTaskProof, null);
  const [proofPath, setProofPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Submitted.");
      onDone();
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router, onDone]);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);

    const result = await uploadTaskProof(fd);
    setUploading(false);

    if (result.success && result.data) {
      setProofPath(result.data.path);
      setFileName(file.name);
      toast.success("Screenshot uploaded.");
    } else {
      toast.error(result.error ?? "Upload failed.");
      event.target.value = "";
    }
  }

  const needsProof = task?.requires_proof ?? false;

  return (
    <Dialog open={task !== null} onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task?.title}</DialogTitle>
          <DialogDescription>
            Complete the task, then{" "}
            {needsProof ? "upload a screenshot as proof" : "submit to claim your reward"}. Rewards
            are credited after review.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="taskId" value={task?.id ?? ""} />
          <input type="hidden" name="proofUrl" value={proofPath} />

          {task?.instructions && (
            <div className="whitespace-pre-line rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
              {task.instructions}
            </div>
          )}

          {task?.target_url && (
            <Button asChild variant="outline" size="sm" className="w-full">
              <a href={task.target_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Open task link
              </a>
            </Button>
          )}

          {needsProof && (
            <div className="space-y-2">
              <Label htmlFor="proof-file">Screenshot proof</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="proof-file"
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onFile}
                  disabled={uploading}
                  className="text-xs"
                />
                {uploading && <Loader2 className="size-4 shrink-0 animate-spin" />}
                {proofPath && !uploading && (
                  <Check className="size-4 shrink-0 text-emerald-400" />
                )}
              </div>
              {fileName && (
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Upload className="size-3 shrink-0" />
                  {fileName}
                </p>
              )}
              <p className="text-xs text-muted-foreground">JPG, PNG or WebP up to 5 MB.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="proof-note">
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="proof-note"
              name="proofNote"
              rows={2}
              maxLength={500}
              placeholder="Your username on the platform"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <SubmitButton
              variant="gradient"
              size="sm"
              pendingText="Submitting…"
              disabled={uploading || (needsProof && !proofPath)}
            >
              Submit for review
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
