"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { SubmitButton } from "@/components/shared/submit-button";
import { cancelMarket, deleteMarket, resolveMarket } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";
import type { ActionResult, Market, MarketOption } from "@/types/database";

type Panel = "resolve" | "cancel" | null;

export function MarketActions({
  market,
  options,
}: {
  market: Market;
  options: MarketOption[];
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [optionId, setOptionId] = useState(options[0]?.id ?? "");
  const [deleting, startDelete] = useTransition();
  const router = useRouter();

  const settled = market.status === "resolved" || market.status === "cancelled";

  function remove() {
    startDelete(async () => {
      const result = await deleteMarket(market.id);
      if (result.success) {
        toast.success(result.message ?? "Market deleted.");
        router.push("/admin/markets");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not delete this market.");
      }
    });
  }

  if (settled) {
    return (
      <p className="text-sm text-muted-foreground">
        This market is {market.status}. Positions have already been settled and no further action is
        possible.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="gradient"
          size="sm"
          disabled={options.length === 0}
          onClick={() => {
            setOptionId(options[0]?.id ?? "");
            setPanel("resolve");
          }}
        >
          Resolve market
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPanel("cancel")}>
          Cancel &amp; refund
        </Button>
        {market.trade_count === 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={remove}
            disabled={deleting}
            className="text-red-400 hover:text-red-300"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Delete
          </Button>
        )}
      </div>

      <ResolveDialog
        open={panel === "resolve"}
        onDone={() => setPanel(null)}
        market={market}
        options={options}
        optionId={optionId}
        setOptionId={setOptionId}
      />
      <CancelDialog open={panel === "cancel"} onDone={() => setPanel(null)} market={market} />
    </>
  );
}

function useMarketAction(
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>,
  onDone: () => void
) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Done.");
      onDone();
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router, onDone]);

  return formAction;
}

function ResolveDialog({
  open,
  onDone,
  market,
  options,
  optionId,
  setOptionId,
}: {
  open: boolean;
  onDone: () => void;
  market: Market;
  options: MarketOption[];
  optionId: string;
  setOptionId: (id: string) => void;
}) {
  const formAction = useMarketAction(resolveMarket, onDone);
  const selected = options.find((option) => option.id === optionId);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve market</DialogTitle>
          <DialogDescription>
            Winning positions are paid out immediately and everyone is notified. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="marketId" value={market.id} />
          <input type="hidden" name="optionId" value={optionId} />

          <p className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs">
            {market.title}
          </p>

          <div className="space-y-2">
            <Label>Winning outcome</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setOptionId(option.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    optionId === option.id
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                      : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="block truncate">{option.label}</span>
                  <span className="mt-0.5 block font-mono text-[11px] opacity-80">
                    {Math.round(Number(option.odds) * 100)}¢
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resolve-note">
              Resolution note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="resolve-note"
              name="note"
              rows={3}
              maxLength={500}
              placeholder="Final score and the source you used to settle."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <SubmitButton
              variant="gradient"
              size="sm"
              pendingText="Settling…"
              disabled={!optionId}
            >
              Pay out {selected?.label ?? "winner"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  open,
  onDone,
  market,
}: {
  open: boolean;
  onDone: () => void;
  market: Market;
}) {
  const formAction = useMarketAction(cancelMarket, onDone);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel market</DialogTitle>
          <DialogDescription>
            Every open position is refunded in full, including fees. Use this when a match is
            abandoned or the question became unresolvable.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="marketId" value={market.id} />

          <p className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs">
            {market.title}
            <span className="mt-1 block text-muted-foreground">
              {market.trade_count.toLocaleString()} position
              {market.trade_count === 1 ? "" : "s"} will be refunded.
            </span>
          </p>

          <div className="space-y-2">
            <Label htmlFor="cancel-note">Reason</Label>
            <Textarea
              id="cancel-note"
              name="note"
              rows={3}
              maxLength={500}
              required
              placeholder="Shown to everyone holding a position."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Back
            </Button>
            <SubmitButton variant="destructive" size="sm" pendingText="Refunding…">
              Cancel &amp; refund all
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
