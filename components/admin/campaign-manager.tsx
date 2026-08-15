"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Pencil, Plus, Trophy, Trash2 } from "lucide-react";
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
import {
  deleteCampaign,
  getCampaignStandings,
  saveCampaign,
  setCampaignWinner,
} from "@/lib/actions/admin";
import { CAMPAIGN_METRICS } from "@/lib/constants";
import { formatScore, metricBlurb, metricLabel } from "@/lib/campaign";
import { cn } from "@/lib/utils";
import type {
  ActionResult,
  Campaign,
  CampaignMetric,
  LeaderboardRow,
} from "@/types/database";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function campaignStatus(c: Campaign) {
  if (!c.is_active) return { label: "Hidden", className: "bg-secondary text-muted-foreground" };
  const now = Date.now();
  if (now < new Date(c.starts_at).getTime())
    return { label: "Scheduled", className: "bg-sky-500/15 text-sky-300" };
  if (now > new Date(c.ends_at).getTime())
    return { label: "Ended", className: "bg-secondary text-muted-foreground" };
  return { label: "Live", className: "bg-emerald-500/15 text-emerald-300" };
}

export function CampaignManager({ campaigns }: { campaigns: Campaign[] }) {
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const [standingsFor, setStandingsFor] = useState<Campaign | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          A campaign ranks users by one metric over its window and goes live on its own once it
          starts — no scheduler. Pick a winner from the leaderboard, then pay the prize with the
          balance tools.
        </p>
        <Button variant="gradient" size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          New campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No campaigns"
          description="Create a time-boxed competition to reward your most active users."
        />
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <CampaignRow
              key={campaign.id}
              campaign={campaign}
              onEdit={() => setEditing(campaign)}
              onStandings={() => setStandingsFor(campaign)}
            />
          ))}
        </div>
      )}

      <CampaignDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        open={editing !== null}
        campaign={editing === "new" ? undefined : (editing ?? undefined)}
        onDone={() => setEditing(null)}
      />

      {standingsFor && (
        <StandingsDialog
          key={standingsFor.id}
          campaign={standingsFor}
          onClose={() => setStandingsFor(null)}
        />
      )}
    </div>
  );
}

function CampaignRow({
  campaign,
  onEdit,
  onStandings,
}: {
  campaign: Campaign;
  onEdit: () => void;
  onStandings: () => void;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function remove() {
    start(async () => {
      const result = await deleteCampaign(campaign.id);
      if (result.success) {
        toast.success(result.message ?? "Campaign deleted.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not delete this campaign.");
      }
    });
  }

  const status = campaignStatus(campaign);

  return (
    <Card className={cn("glass", !campaign.is_active && "opacity-60")}>
      <CardContent className="flex flex-wrap items-start gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold">{campaign.title}</p>
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", status.className)}>
              {status.label}
            </span>
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {metricLabel(campaign.metric)}
            </span>
            {campaign.winner_id && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                <Crown className="size-3" />
                Winner chosen
              </span>
            )}
          </div>

          {campaign.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{campaign.description}</p>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              {formatWhen(campaign.starts_at)} → {formatWhen(campaign.ends_at)}
            </span>
            {campaign.prize_note && <span className="truncate">Prize: {campaign.prize_note}</span>}
          </div>

          {campaign.winner_note && (
            <p className="text-xs text-amber-300/80">Winner note: {campaign.winner_note}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onStandings} className="gap-1.5">
            <Trophy className="size-4" />
            Leaderboard
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit campaign">
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={pending}
            aria-label="Delete campaign"
            className="text-red-400 hover:text-red-300"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignDialog({
  open,
  campaign,
  onDone,
}: {
  open: boolean;
  campaign?: Campaign;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveCampaign, null);
  const [metric, setMetric] = useState<CampaignMetric>(campaign?.metric ?? "trading_volume");
  const [active, setActive] = useState(campaign?.is_active ?? true);

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
          <DialogTitle>{campaign ? "Edit campaign" : "New campaign"}</DialogTitle>
          <DialogDescription>
            The campaign is live only while it is visible and the current time sits inside its
            window.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {campaign && <input type="hidden" name="id" value={campaign.id} />}
          <input type="hidden" name="metric" value={metric} />
          <input type="hidden" name="isActive" value={active ? "true" : "false"} />

          <div className="space-y-2">
            <Label htmlFor="campaign-title">Title</Label>
            <Input
              id="campaign-title"
              name="title"
              defaultValue={campaign?.title ?? ""}
              maxLength={120}
              required
              placeholder="August trading sprint"
            />
            {err?.title && <p className="text-xs text-red-400">{err.title[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="campaign-description"
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={campaign?.description ?? ""}
              placeholder="Top the board by trade volume before the window closes."
            />
            {err?.description && <p className="text-xs text-red-400">{err.description[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-metric">Ranking metric</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as CampaignMetric)}>
              <SelectTrigger id="campaign-metric" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAMPAIGN_METRICS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{metricBlurb(metric)}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-starts">Starts</Label>
              <Input
                id="campaign-starts"
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={toLocalInput(campaign?.starts_at ?? null)}
              />
              {err?.startsAt && <p className="text-xs text-red-400">{err.startsAt[0]}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-ends">Ends</Label>
              <Input
                id="campaign-ends"
                name="endsAt"
                type="datetime-local"
                required
                defaultValue={toLocalInput(campaign?.ends_at ?? null)}
              />
              {err?.endsAt && <p className="text-xs text-red-400">{err.endsAt[0]}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-prize">
              Prize note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="campaign-prize"
              name="prizeNote"
              maxLength={500}
              defaultValue={campaign?.prize_note ?? ""}
              placeholder="500 USDG to the top trader"
            />
            {err?.prizeNote && <p className="text-xs text-red-400">{err.prizeNote[0]}</p>}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="campaign-active" className="cursor-pointer">
                Visible
              </Label>
              <p className="text-xs text-muted-foreground">
                Turn off to pull the campaign without deleting it.
              </p>
            </div>
            <Switch id="campaign-active" checked={active} onCheckedChange={setActive} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <SubmitButton variant="gradient" size="sm" pendingText="Saving…">
              {campaign ? "Save changes" : "Create campaign"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StandingsDialog({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [winnerId, setWinnerId] = useState(campaign.winner_id);
  const [saving, start] = useTransition();

  useEffect(() => {
    let live = true;
    getCampaignStandings(campaign.id).then((result) => {
      if (!live) return;
      if (result.success && result.data) setRows(result.data);
      else setError(result.error ?? "Could not load the leaderboard.");
    });
    return () => {
      live = false;
    };
  }, [campaign.id]);

  function choose(userId: string) {
    start(async () => {
      const result = await setCampaignWinner(campaign.id, userId, note);
      if (result.success) {
        setWinnerId(userId);
        toast.success(result.message ?? "Winner recorded.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not set the winner.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{campaign.title}</DialogTitle>
          <DialogDescription>
            Ranked by {metricLabel(campaign.metric).toLowerCase()}. Choosing a winner only records
            it — credit the prize afterward with the balance tools.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="winner-note">
            Winner note <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="winner-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Reason or prize detail, saved with the winner"
          />
        </div>

        {rows === null && !error ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-400">{error}</p>
        ) : rows && rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity in this window yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows?.map((row) => {
              const isWinner = row.user_id === winnerId;
              return (
                <li key={row.user_id} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 shrink-0 text-center font-mono text-sm text-muted-foreground">
                    {row.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {row.handle}
                      {isWinner && <Crown className="ml-1 inline size-3.5 text-amber-300" />}
                    </p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {row.user_id}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm tabular-nums">
                    {formatScore(campaign.metric, row.score)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={isWinner ? "secondary" : "ghost"}
                    disabled={saving}
                    onClick={() => choose(row.user_id)}
                    className="shrink-0"
                  >
                    {isWinner ? "Winner" : "Set winner"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
