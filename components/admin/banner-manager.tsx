"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { deleteBanner, saveBanner } from "@/lib/actions/admin";
import { cn, formatCurrency, toNumber } from "@/lib/utils";
import type { ActionResult, PromoBanner } from "@/types/database";

const GRADIENTS = [
  { value: "from-violet-600 to-fuchsia-600", label: "Violet → Fuchsia" },
  { value: "from-cyan-500 to-blue-600", label: "Cyan → Blue" },
  { value: "from-emerald-500 to-teal-600", label: "Emerald → Teal" },
  { value: "from-amber-500 to-orange-600", label: "Amber → Orange" },
  { value: "from-rose-500 to-pink-600", label: "Rose → Pink" },
  { value: "from-slate-700 to-slate-900", label: "Slate" },
];

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function BannerManager({ banners }: { banners: PromoBanner[] }) {
  const [editing, setEditing] = useState<PromoBanner | "new" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Banners appear on the landing page in position order. A banner switches itself off once its
          claim limit is reached.
        </p>
        <Button variant="gradient" size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          New banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No promo banners"
          description="Create one to highlight a bonus or campaign on the landing page."
        />
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => (
            <BannerRow key={banner.id} banner={banner} onEdit={() => setEditing(banner)} />
          ))}
        </div>
      )}

      <BannerDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        open={editing !== null}
        banner={editing === "new" ? undefined : (editing ?? undefined)}
        onDone={() => setEditing(null)}
      />
    </div>
  );
}

function BannerRow({ banner, onEdit }: { banner: PromoBanner; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function remove() {
    start(async () => {
      const result = await deleteBanner(banner.id);
      if (result.success) {
        toast.success(result.message ?? "Banner deleted.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not delete this banner.");
      }
    });
  }

  const limit = banner.user_limit;
  const claimed = banner.claimed_count;
  const exhausted = limit !== null && claimed >= limit;

  return (
    <Card className={cn("glass overflow-hidden", !banner.is_active && "opacity-60")}>
      <div className={cn("h-1.5 bg-gradient-to-r", banner.bg_gradient ?? "from-violet-600 to-fuchsia-600")} />
      <CardContent className="flex flex-wrap items-start gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold">{banner.title}</p>
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              #{banner.position}
            </span>
            {!banner.is_active && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Hidden
              </span>
            )}
            {exhausted && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                Limit reached
              </span>
            )}
          </div>

          {banner.subtitle && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{banner.subtitle}</p>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {toNumber(banner.bonus_amount) > 0 && (
              <span>
                Bonus{" "}
                <span className="font-mono text-foreground">
                  {formatCurrency(banner.bonus_amount)} USDG
                </span>
              </span>
            )}
            {banner.link_url && <span className="truncate">Links to {banner.link_url}</span>}
            {banner.ends_at && (
              <span>
                Ends{" "}
                {new Date(banner.ends_at).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>

          {limit !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Claimed</span>
                <span className="font-mono">
                  {claimed.toLocaleString()} / {limit.toLocaleString()}
                </span>
              </div>
              <Progress value={Math.min(100, (claimed / limit) * 100)} className="h-1.5" />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit banner">
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={pending}
            aria-label="Delete banner"
            className="text-red-400 hover:text-red-300"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BannerDialog({
  open,
  banner,
  onDone,
}: {
  open: boolean;
  banner?: PromoBanner;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveBanner, null);
  const [gradient, setGradient] = useState(banner?.bg_gradient ?? GRADIENTS[0].value);
  const [active, setActive] = useState(banner?.is_active ?? true);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Saved.");
      onDone();
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router, onDone]);

  const err = state?.fieldErrors;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{banner ? "Edit banner" : "New promo banner"}</DialogTitle>
          <DialogDescription>
            Set a claim limit to cap how many users can take the offer — the banner hides itself once
            the cap is hit.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {banner && <input type="hidden" name="id" value={banner.id} />}
          <input type="hidden" name="bgGradient" value={gradient} />
          <input type="hidden" name="isActive" value={active ? "true" : "false"} />

          <div className="space-y-2">
            <Label htmlFor="banner-title">Title</Label>
            <Input
              id="banner-title"
              name="title"
              defaultValue={banner?.title ?? ""}
              maxLength={120}
              required
              placeholder="Double your first deposit"
            />
            {err?.title && <p className="text-xs text-red-400">{err.title[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="banner-subtitle">
              Subtitle <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="banner-subtitle"
              name="subtitle"
              rows={2}
              maxLength={240}
              defaultValue={banner?.subtitle ?? ""}
            />
            {err?.subtitle && <p className="text-xs text-red-400">{err.subtitle[0]}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="banner-cta">
                Button text <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="banner-cta"
                name="ctaText"
                defaultValue={banner?.cta_text ?? ""}
                maxLength={40}
                placeholder="Claim now"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-link">
                Link <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="banner-link"
                name="linkUrl"
                defaultValue={banner?.link_url ?? ""}
                maxLength={500}
                placeholder="/wallet/deposit"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="banner-image">
                Image URL <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="banner-image"
                name="imageUrl"
                type="url"
                defaultValue={banner?.image_url ?? ""}
                maxLength={500}
                placeholder="https://…"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="banner-gradient">Background</Label>
              <Select value={gradient} onValueChange={setGradient}>
                <SelectTrigger id="banner-gradient" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADIENTS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className={cn("h-8 rounded-lg bg-gradient-to-r", gradient)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-bonus">Bonus amount (USDG)</Label>
              <Input
                id="banner-bonus"
                name="bonusAmount"
                type="number"
                step="0.01"
                min="0"
                className="font-mono"
                defaultValue={banner ? toNumber(banner.bonus_amount) : 0}
              />
              {err?.bonusAmount && <p className="text-xs text-red-400">{err.bonusAmount[0]}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-limit">
                Claim limit <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="banner-limit"
                name="userLimit"
                type="number"
                min="1"
                step="1"
                className="font-mono"
                defaultValue={banner?.user_limit ?? ""}
                placeholder="Unlimited"
              />
              {err?.userLimit && <p className="text-xs text-red-400">{err.userLimit[0]}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-starts">
                Starts <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="banner-starts"
                name="startsAt"
                type="datetime-local"
                defaultValue={toLocalInput(banner?.starts_at ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-ends">
                Ends <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="banner-ends"
                name="endsAt"
                type="datetime-local"
                defaultValue={toLocalInput(banner?.ends_at ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-position">Position</Label>
              <Input
                id="banner-position"
                name="position"
                type="number"
                min="0"
                step="1"
                className="font-mono"
                defaultValue={banner?.position ?? 0}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="banner-active" className="cursor-pointer">
                Visible
              </Label>
              <p className="text-xs text-muted-foreground">
                Turn off to pull the banner without deleting it.
              </p>
            </div>
            <Switch id="banner-active" checked={active} onCheckedChange={setActive} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <SubmitButton variant="gradient" size="sm" pendingText="Saving…">
              {banner ? "Save changes" : "Create banner"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
