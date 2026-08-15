import { Crown, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatScore, metricLabel } from "@/lib/campaign";
import { cn } from "@/lib/utils";
import type { Campaign, LeaderboardRow } from "@/types/database";

function rankStyle(rank: number) {
  if (rank === 1) return "bg-amber-500/15 text-amber-300 ring-amber-500/30";
  if (rank === 2) return "bg-slate-400/15 text-slate-200 ring-slate-400/30";
  if (rank === 3) return "bg-orange-500/15 text-orange-300 ring-orange-500/30";
  return "bg-secondary text-muted-foreground ring-border/60";
}

export function CampaignBoard({
  campaign,
  rows,
  currentUserId,
}: {
  campaign: Campaign;
  rows: LeaderboardRow[];
  currentUserId: string;
}) {
  return (
    <Card className="glass-strong overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-primary to-accent" />
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Live
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
            Ranked by {metricLabel(campaign.metric).toLowerCase()}
          </span>
        </div>
        <CardTitle className="text-xl">{campaign.title}</CardTitle>
        {campaign.description && <CardDescription>{campaign.description}</CardDescription>}
        <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1 text-xs text-muted-foreground">
          <span>
            Ends{" "}
            {new Date(campaign.ends_at).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          {campaign.prize_note && (
            <span className="inline-flex items-center gap-1 text-amber-300">
              <Trophy className="size-3.5" />
              {campaign.prize_note}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="px-6 pb-6">
            <EmptyState
              icon={Trophy}
              title="No one on the board yet"
              description="Be the first to place — standings update as activity comes in."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((row) => {
              const isYou = row.user_id === currentUserId;
              return (
                <li
                  key={row.user_id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    isYou && "bg-primary/[0.07]"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full font-mono text-sm font-semibold ring-1 ring-inset",
                      rankStyle(row.rank)
                    )}
                  >
                    {row.rank}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {isYou ? "You" : row.handle}
                      {campaign.winner_id === row.user_id && (
                        <Crown className="ml-1 inline size-3.5 text-amber-300" />
                      )}
                    </p>
                  </div>

                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {formatScore(campaign.metric, row.score)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
