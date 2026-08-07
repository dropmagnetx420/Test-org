"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { setMarketVolume } from "@/lib/actions/admin";
import { formatCurrency, toNumber } from "@/lib/utils";
import type { ActionResult, MarketOption } from "@/types/database";

export function VolumeSeeder({
  marketId,
  options,
}: {
  marketId: string;
  options: MarketOption[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    setMarketVolume,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Saved.");
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Seeded volume</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Seeded volume shifts the displayed odds without touching real trades. Revenue reporting
          always excludes it.
        </p>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="marketId" value={marketId} />

          {options.map((option) => (
            <div key={option.id} className="grid gap-2 sm:grid-cols-[1fr_160px] sm:items-center">
              <input type="hidden" name="seedOptionId" value={option.id} />
              <Label htmlFor={`seed-${option.id}`} className="text-sm">
                {option.label}
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  real {formatCurrency(option.real_volume)}
                </span>
              </Label>
              <Input
                id={`seed-${option.id}`}
                name="seedVolume"
                type="number"
                step="0.01"
                min="0"
                defaultValue={toNumber(option.seed_volume)}
                className="font-mono"
              />
            </div>
          ))}

          <div className="flex justify-end">
            <SubmitButton variant="outline" size="sm" pendingText="Saving…">
              Save seeded volume
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
