"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Clock, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { claimAdReward } from "@/lib/actions/earn";
import { cn, formatCurrency } from "@/lib/utils";

interface Props {
  reward: number;
  watchSeconds: number;
  dailyLimit: number;
  claimedToday: number;
  children?: React.ReactNode;
}

export function AdWatcher({
  reward,
  watchSeconds,
  dailyLimit,
  claimedToday,
  children,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "watching" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [localClaimed, setLocalClaimed] = useState(claimedToday);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  const capped = localClaimed >= dailyLimit;

  const startWatching = useCallback(() => {
    setPhase("watching");
    setElapsed(0);
    startRef.current = Date.now();

    function tick() {
      const e = (Date.now() - startRef.current) / 1000;
      setElapsed(Math.min(e, watchSeconds));
      if (e < watchSeconds) rafRef.current = requestAnimationFrame(tick);
      else setPhase("done");
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [watchSeconds]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  async function claim() {
    setClaiming(true);
    const result = await claimAdReward({
      placement: "earn_page",
      watchMs: Math.round(elapsed * 1000),
    });
    setClaiming(false);

    if (result.success && result.data) {
      toast.success(result.message ?? "Reward claimed.");
      setLocalClaimed((c) => c + 1);
      setPhase("idle");
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not claim reward.");
    }
  }

  const progress = Math.min(100, (elapsed / watchSeconds) * 100);

  return (
    <Card className="glass">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="space-y-0.5">
          <CardTitle className="text-base">Watch & earn</CardTitle>
          <p className="text-xs text-muted-foreground">
            Watch a short ad and earn {formatCurrency(reward)} USDG
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {localClaimed} / {dailyLimit} today
        </div>
      </CardHeader>

      <CardContent>
        {phase === "idle" && (
          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={startWatching}
            disabled={capped}
          >
            <Play className="size-5" />
            {capped ? "Limit reached" : "Watch ad"}
          </Button>
        )}

        {phase === "watching" && (
          <div className="space-y-3">
            {children && <div className="min-h-24 overflow-hidden rounded-lg">{children}</div>}
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Keep watching…{" "}
              <span className="font-mono">
                {Math.ceil(watchSeconds - elapsed)}s
              </span>{" "}
              remaining
            </p>
          </div>
        )}

        {phase === "done" && (
          <Button
            variant="gradient"
            size="lg"
            className={cn("w-full", claiming && "animate-pulse")}
            onClick={claim}
            disabled={claiming}
          >
            {claiming ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Claiming…
              </>
            ) : (
              <>
                <Check className="size-5" />
                Claim {formatCurrency(reward)} USDG
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
