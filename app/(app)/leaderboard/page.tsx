import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { CampaignBoard } from "@/components/leaderboard/campaign-board";
import { EmptyState } from "@/components/shared/empty-state";
import { requireProfile } from "@/lib/auth";
import { getCampaignLeaderboard, getLiveCampaign } from "@/lib/queries";

export const metadata: Metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const profile = await requireProfile();
  const campaign = await getLiveCampaign();
  const rows = campaign ? await getCampaignLeaderboard(campaign.id, 50) : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Climb the board during a live campaign — the top spots take the prize.
        </p>
      </header>

      {campaign ? (
        <CampaignBoard campaign={campaign} rows={rows} currentUserId={profile.id} />
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/40 px-4 py-12">
          <EmptyState
            icon={Trophy}
            title="No active campaign"
            description="Nothing is running right now. Check back soon — competitions and winners show up here."
          />
        </div>
      )}
    </div>
  );
}
