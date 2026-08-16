"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { StaggerGrid, StaggerItem } from "@/components/shared/motion";
import { SubmitButton } from "@/components/shared/submit-button";
import { saveAdPlacement } from "@/lib/actions/admin";
import { AD_FORMATS, AD_PLACEMENTS, AD_PROVIDERS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ActionResult, AdPlacementConfig, AdPlacementSlot } from "@/types/database";

const HINTS: Record<string, string> = {
  admob: "Paste the AdMob ad unit ID, e.g. ca-app-pub-1234567890/1234567890.",
  adsterra: "Paste the Adsterra invoke script URL and its key.",
  startio: "Paste the Start.io app ID and, if used, the script URL.",
};

export function AdManager({
  placements,
}: {
  placements: Partial<Record<AdPlacementSlot, AdPlacementConfig>>;
}) {
  return (
    <StaggerGrid className="space-y-4">
      {AD_PLACEMENTS.map((slot) => (
        <StaggerItem key={slot.value}>
          <PlacementCard slot={slot.value} label={slot.label} config={placements[slot.value]} />
        </StaggerItem>
      ))}
    </StaggerGrid>
  );
}

function PlacementCard({
  slot,
  label,
  config,
}: {
  slot: AdPlacementSlot;
  label: string;
  config?: AdPlacementConfig;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveAdPlacement, null);
  const [provider, setProvider] = useState(config?.provider ?? AD_PROVIDERS[0].value);
  const [format, setFormat] = useState(config?.format ?? "banner");
  const [active, setActive] = useState(config?.is_active ?? false);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Saved.");
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const rewarded = slot === "earn_page";
  const err = state?.fieldErrors;

  return (
    <Card className={cn("glass", !active && "opacity-75")}>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="space-y-0.5">
          <CardTitle className="text-base">{label}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {rewarded
              ? "Rewarded video users watch to earn. Reward and watch time live in General settings."
              : "Display slot rendered on the site."}
          </p>
        </div>
        {config?.is_active && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            Live
          </span>
        )}
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="placement" value={slot} />
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="format" value={format} />
          <input type="hidden" name="isActive" value={active ? "true" : "false"} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${slot}-provider`}>Provider</Label>
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as AdPlacementConfig["provider"])}
              >
                <SelectTrigger id={`${slot}-provider`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AD_PROVIDERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${slot}-format`}>Format</Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as AdPlacementConfig["format"])}
              >
                <SelectTrigger id={`${slot}-format`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AD_FORMATS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${slot}-unit`}>Ad unit / account ID</Label>
              <Input
                id={`${slot}-unit`}
                name="unitId"
                defaultValue={config?.unit_id ?? ""}
                maxLength={200}
                className="font-mono text-xs"
                placeholder="ca-app-pub-…"
              />
              <p className="text-xs text-muted-foreground">{HINTS[provider]}</p>
              {err?.unitId && <p className="text-xs text-red-400">{err.unitId[0]}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${slot}-script`}>
                Script URL <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${slot}-script`}
                name="scriptUrl"
                type="url"
                defaultValue={config?.script_url ?? ""}
                maxLength={500}
                className="font-mono text-xs"
                placeholder="https://…"
              />
              {err?.scriptUrl && <p className="text-xs text-red-400">{err.scriptUrl[0]}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${slot}-key`}>
                Script key <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${slot}-key`}
                name="scriptKey"
                defaultValue={config?.script_key ?? ""}
                maxLength={200}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${slot}-width`}>
                Width <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${slot}-width`}
                name="width"
                type="number"
                min="1"
                max="2000"
                defaultValue={config?.width ?? ""}
                className="font-mono text-xs"
                placeholder="300"
              />
              {err?.width && <p className="text-xs text-red-400">{err.width[0]}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${slot}-height`}>
                Height <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${slot}-height`}
                name="height"
                type="number"
                min="1"
                max="2000"
                defaultValue={config?.height ?? ""}
                className="font-mono text-xs"
                placeholder="250"
              />
              {err?.height && <p className="text-xs text-red-400">{err.height[0]}</p>}
            </div>

            <p className="text-xs text-muted-foreground sm:col-span-2">
              Adsterra display banners must match the size of the unit in your dashboard. Leave
              blank for 300×250.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
            <div className="space-y-0.5">
              <Label htmlFor={`${slot}-active`} className="cursor-pointer">
                Enabled
              </Label>
              <p className="text-xs text-muted-foreground">
                Off hides this slot everywhere on the site.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch id={`${slot}-active`} checked={active} onCheckedChange={setActive} />
              <SubmitButton variant="gradient" size="sm" pendingText="Saving…">
                Save
              </SubmitButton>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
