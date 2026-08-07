"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import type { ActionResult } from "@/types/database";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

interface ReviewDialogProps {
  action: Action;
  requestId: string;
  triggerLabel: string;
  triggerVariant?: "gradient" | "outline" | "destructive" | "default";
  title: string;
  description: string;
  confirmLabel: string;
  noteLabel?: string;
  notePlaceholder?: string;
  noteRequired?: boolean;
  withTxHash?: boolean;
  approve?: boolean;
  summary?: React.ReactNode;
}

export function ReviewDialog({
  action,
  requestId,
  triggerLabel,
  triggerVariant = "outline",
  title,
  description,
  confirmLabel,
  noteLabel = "Note",
  notePlaceholder = "Optional note kept on the record.",
  noteRequired = false,
  withTxHash = false,
  approve,
  summary,
}: ReviewDialogProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  const [seen, setSeen] = useState<ActionResult | null>(null);
  if (state !== seen) {
    setSeen(state);
    if (state?.success) setOpen(false);
  }

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Done.");
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {summary && (
          <div className="space-y-1 rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs">
            {summary}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="requestId" value={requestId} />
          {approve !== undefined && (
            <input type="hidden" name="approve" value={approve ? "true" : "false"} />
          )}

          {withTxHash && (
            <div className="space-y-2">
              <Label htmlFor={`tx-${requestId}`}>
                Payout transaction hash{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`tx-${requestId}`}
                name="txHash"
                placeholder="0x…"
                className="font-mono text-xs"
              />
              {state?.fieldErrors?.txHash && (
                <p className="text-xs text-red-400">{state.fieldErrors.txHash[0]}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`note-${requestId}`}>
              {noteLabel}
              {!noteRequired && <span className="ml-1 text-muted-foreground">(optional)</span>}
            </Label>
            <Textarea
              id={`note-${requestId}`}
              name="note"
              rows={3}
              required={noteRequired}
              maxLength={500}
              placeholder={notePlaceholder}
            />
            {state?.fieldErrors?.note && (
              <p className="text-xs text-red-400">{state.fieldErrors.note[0]}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton
              variant={triggerVariant === "destructive" ? "destructive" : "gradient"}
              size="sm"
              pendingText="Working…"
            >
              {confirmLabel}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
