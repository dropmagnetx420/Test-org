"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { closeExpiredMarkets } from "@/lib/actions/admin";

export function CloseExpiredButton() {
  const [pending, start] = useTransition();
  const router = useRouter();

  function run() {
    start(async () => {
      const result = await closeExpiredMarkets();
      if (result.success) {
        toast.success(result.message ?? "Markets closed.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not close markets.");
      }
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={run} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <TimerReset className="size-4" />}
      Close expired now
    </Button>
  );
}
