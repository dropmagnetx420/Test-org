"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { createMarket, updateMarket } from "@/lib/actions/admin";
import { SPORTS } from "@/lib/constants";
import { toNumber } from "@/lib/utils";
import type { ActionResult, Market, MarketOption } from "@/types/database";

/** `datetime-local` needs a local-time `YYYY-MM-DDTHH:mm` string, not an ISO UTC one. */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

const STATUSES = [
  { value: "draft", label: "Draft — hidden from users" },
  { value: "open", label: "Open — accepting predictions" },
  { value: "closed", label: "Closed — awaiting resolution" },
];

const MAX_OUTCOMES = 8;

interface OutcomeRow {
  label: string;
  odds: string;
  seed: string;
}

export function MarketForm({
  market,
  options = [],
}: {
  market?: Market;
  options?: MarketOption[];
}) {
  const editing = Boolean(market);
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    editing ? updateMarket : createMarket,
    null
  );

  const [outcomes, setOutcomes] = useState<OutcomeRow[]>(() =>
    options.length > 0
      ? options.map((option) => ({
          label: option.label,
          odds: toNumber(option.odds).toFixed(4),
          seed: toNumber(option.seed_volume).toString(),
        }))
      : [
          { label: "YES", odds: "0.5", seed: "0" },
          { label: "NO", odds: "0.5", seed: "0" },
        ]
  );

  // Prices move with trading volume, so the outcome set is fixed once a market
  // has positions on it.
  const outcomesLocked = editing && (market?.trade_count ?? 0) > 0;

  function updateOutcome(index: number, patch: Partial<OutcomeRow>) {
    setOutcomes((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Saved.");
      router.push("/admin/markets");
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const oddsSum = outcomes.reduce((sum, row) => sum + (Number(row.odds) || 0), 0);
  const oddsBalanced = Math.abs(oddsSum - 1) < 0.01;
  const err = state?.fieldErrors;

  return (
    <form action={formAction} className="space-y-6">
      {editing && <input type="hidden" name="marketId" value={market!.id} />}

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Match details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sport">Sport</Label>
            <Select name="sport" defaultValue={market?.sport ?? "football"}>
              <SelectTrigger id="sport" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPORTS.map((sport) => (
                  <SelectItem key={sport.value} value={sport.value}>
                    {sport.icon} {sport.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={err?.sport?.[0]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="league">
              League <Optional />
            </Label>
            <Input
              id="league"
              name="league"
              defaultValue={market?.league ?? ""}
              maxLength={80}
              placeholder="e.g. Premier League"
            />
            <FieldError message={err?.league?.[0]} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Question</Label>
            <Input
              id="title"
              name="title"
              defaultValue={market?.title ?? ""}
              maxLength={160}
              required
              placeholder="Will Arsenal beat Chelsea on 12 May?"
            />
            <p className="text-xs text-muted-foreground">
              Phrase it so every outcome is unambiguous at resolution time.
            </p>
            <FieldError message={err?.title?.[0]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="teamA">
              Team A <Optional />
            </Label>
            <Input id="teamA" name="teamA" defaultValue={market?.team_a ?? ""} maxLength={80} />
            <FieldError message={err?.teamA?.[0]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="teamB">
              Team B <Optional />
            </Label>
            <Input id="teamB" name="teamB" defaultValue={market?.team_b ?? ""} maxLength={80} />
            <FieldError message={err?.teamB?.[0]} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">
              Description <Optional />
            </Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              maxLength={1000}
              defaultValue={market?.description ?? ""}
              placeholder="Context shown on the market page."
            />
            <FieldError message={err?.description?.[0]} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rules">
              Resolution rules <Optional />
            </Label>
            <Textarea
              id="rules"
              name="rules"
              rows={4}
              maxLength={2000}
              defaultValue={market?.rules ?? ""}
              placeholder="Exactly which outcome wins, and which source settles it."
            />
            <FieldError message={err?.rules?.[0]} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="imageUrl">
              Image URL <Optional />
            </Label>
            <Input
              id="imageUrl"
              name="imageUrl"
              type="url"
              maxLength={500}
              defaultValue={market?.image_url ?? ""}
              placeholder="https://…"
            />
            <FieldError message={err?.imageUrl?.[0]} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Outcomes</CardTitle>
            {!outcomesLocked && outcomes.length < MAX_OUTCOMES && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOutcomes((rows) => [...rows, { label: "", odds: "", seed: "0" }])}
              >
                <Plus className="size-4" />
                Add outcome
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {outcomesLocked && (
            <p className="text-xs text-amber-300">
              The outcome set is locked because positions exist. You can still edit labels.
            </p>
          )}

          <div className="space-y-3">
            {outcomes.map((outcome, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_120px_120px_auto]">
                <div className="space-y-1">
                  <Label htmlFor={`outcome-label-${index}`} className="sr-only">
                    Outcome {index + 1} label
                  </Label>
                  <Input
                    id={`outcome-label-${index}`}
                    name="outcomeLabel"
                    value={outcome.label}
                    onChange={(e) => updateOutcome(index, { label: e.target.value })}
                    placeholder={`Outcome ${index + 1}`}
                    maxLength={40}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`outcome-odds-${index}`} className="sr-only">
                    Initial odds
                  </Label>
                  <Input
                    id={`outcome-odds-${index}`}
                    name="outcomeOdds"
                    type="number"
                    step="0.0001"
                    min="0.01"
                    max="0.99"
                    value={outcome.odds}
                    onChange={(e) => updateOutcome(index, { odds: e.target.value })}
                    placeholder="Odds"
                    disabled={outcomesLocked}
                    className="font-mono"
                  />
                </div>

                {!editing && (
                  <div className="space-y-1">
                    <Label htmlFor={`outcome-seed-${index}`} className="sr-only">
                      Seed volume
                    </Label>
                    <Input
                      id={`outcome-seed-${index}`}
                      name="outcomeSeed"
                      type="number"
                      step="0.01"
                      min="0"
                      value={outcome.seed}
                      onChange={(e) => updateOutcome(index, { seed: e.target.value })}
                      placeholder="Seed"
                      className="font-mono"
                    />
                  </div>
                )}

                {!outcomesLocked && outcomes.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOutcomes((rows) => rows.filter((_, i) => i !== index))}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {!outcomesLocked && (
            <p className="text-xs text-muted-foreground">
              {oddsBalanced ? (
                <>Odds sum to {oddsSum.toFixed(4)}. Leave blank for an even split.</>
              ) : (
                <span className="text-amber-300">
                  Odds sum to {oddsSum.toFixed(4)} — should be close to 1.00.
                </span>
              )}
            </p>
          )}
          <FieldError message={err?.outcomes?.[0]} />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Trade limits</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">

          <div className="space-y-2">
            <Label htmlFor="minTrade">Minimum stake (USDG)</Label>
            <Input
              id="minTrade"
              name="minTrade"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={market ? toNumber(market.min_trade) : 1}
              className="font-mono"
              required
            />
            <FieldError message={err?.minTrade?.[0]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTrade">Maximum stake (USDG)</Label>
            <Input
              id="maxTrade"
              name="maxTrade"
              type="number"
              step="0.01"
              min="1"
              defaultValue={market ? toNumber(market.max_trade) : 1000}
              className="font-mono"
              required
            />
            <FieldError message={err?.maxTrade?.[0]} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Schedule &amp; visibility</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startTime">Opens</Label>
            <Input
              id="startTime"
              name="startTime"
              type="datetime-local"
              defaultValue={toLocalInput(market?.start_time)}
              required
            />
            <FieldError message={err?.startTime?.[0]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endTime">Closes</Label>
            <Input
              id="endTime"
              name="endTime"
              type="datetime-local"
              defaultValue={toLocalInput(market?.end_time)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Trading stops here. Resolve the market once the result is official.
            </p>
            <FieldError message={err?.endTime?.[0]} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="status">Status</Label>
            <Select
              name="status"
              defaultValue={
                market && ["draft", "open", "closed"].includes(market.status)
                  ? market.status
                  : "draft"
              }
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={err?.status?.[0]} />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
            <Checkbox
              name="isFeatured"
              value="true"
              defaultChecked={market?.is_featured}
              className="mt-0.5"
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">Featured</span>
              <span className="block text-xs text-muted-foreground">
                Pinned to the landing page hero rail.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
            <Checkbox
              name="isTrending"
              value="true"
              defaultChecked={market?.is_trending}
              className="mt-0.5"
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">Trending</span>
              <span className="block text-xs text-muted-foreground">
                Shown in the trending markets section.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/markets")}>
          Cancel
        </Button>
        <SubmitButton variant="gradient" pendingText="Saving…">
          {editing ? "Save changes" : "Create market"}
        </SubmitButton>
      </div>
    </form>
  );
}

function Optional() {
  return <span className="text-muted-foreground">(optional)</span>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-400">{message}</p>;
}
