"use client";

import { Gift, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/shared/copy-button";
import { toast } from "@/components/ui/sonner";
import { SITE_URL } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

export function InviteCard({
  code,
  commission,
  signupReward = 0,
}: {
  code: string;
  commission: string;
  signupReward?: number;
}) {
  const link = `${SITE_URL}/register?ref=${code}`;

  async function share() {
    const text = `Predict sports outcomes with me on NextGen Predict. Sign up with my link and we both earn.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "NextGen Predict", text, url: link });
        return;
      } catch {
        return;
      }
    }
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied.");
  }

  return (
    <Card className="glass-strong">
      <CardHeader>
        <CardTitle className="text-lg">Invite friends</CardTitle>
        <CardDescription>
          You earn {commission}% commission on every trade your referrals make, credited instantly
          as cash.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {signupReward > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3">
            <Gift className="mt-0.5 size-4 shrink-0 text-amber-300" />
            <p className="text-xs text-amber-200/90">
              Plus a{" "}
              <span className="font-semibold text-amber-200">
                {formatCurrency(signupReward)} USDG
              </span>{" "}
              bonus the first time a friend you invite makes a deposit.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your referral code
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="flex-1 font-mono text-lg font-semibold tracking-widest">{code}</p>
            <CopyButton value={code} label="Code" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Invite link
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 p-3">
            <p className="min-w-0 flex-1 break-all font-mono text-xs">{link}</p>
            <CopyButton value={link} label="Link" />
          </div>
        </div>

        <Button type="button" variant="gradient" className="w-full" onClick={share}>
          <Share2 className="size-4" />
          Share invite
        </Button>
      </CardContent>
    </Card>
  );
}
