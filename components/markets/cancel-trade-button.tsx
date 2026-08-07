"use client";

import { useActionState, useEffect } from "react";
import { X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cancelTrade } from "@/lib/actions/trades";
import { formatCurrency, toNumber } from "@/lib/utils";
import type { ActionResult } from "@/types/database";

export function CancelTradeButton({
  tradeId,
  amount,
  cancelFeeMin,
  cancelFeeMax,
}: {
  tradeId: string;
  amount: string;
  cancelFeeMin: string;
  cancelFeeMax: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(cancelTrade, null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success(state.message ?? "Trade cancelled.");
  }, [state]);

  const estimatedRefund = toNumber(amount) - toNumber(cancelFeeMin);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-rose-400 hover:text-rose-300">
          <X className="size-3.5" />
          Cancel
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this prediction?</AlertDialogTitle>
          <AlertDialogDescription>
            Your stake of {formatCurrency(amount)} USDG returns to your available balance, less a
            cancellation fee of {formatCurrency(cancelFeeMin)}–{formatCurrency(cancelFeeMax)} USDG.
            You would receive roughly {formatCurrency(Math.max(0, estimatedRefund))} USDG. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Keep position</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="tradeId" value={tradeId} />
            <AlertDialogAction type="submit">Cancel prediction</AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
