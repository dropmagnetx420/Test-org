import type { Metadata } from "next";
import { TaskList } from "@/components/earn/task-list";
import { AdWatcher } from "@/components/earn/ad-watcher";
import { AdSlot } from "@/components/shared/ad-slot";
import { getEarnTasks, getAdViewsToday } from "@/lib/queries";
import { requireProfile, getSettings } from "@/lib/auth";
import { toNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Earn rewards" };
export const dynamic = "force-dynamic";

export default async function EarnPage() {
  const profile = await requireProfile();
  const settings = await getSettings();

  const [tasks, claimedToday] = await Promise.all([
    getEarnTasks(profile.id),
    settings.ads_enabled ? getAdViewsToday(profile.id) : Promise.resolve(0),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Earn rewards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete tasks, watch ads, and earn funds straight to your wallet.
        </p>
      </header>

      {settings.ads_enabled && (
        <AdWatcher
          reward={toNumber(settings.ad_reward)}
          watchSeconds={settings.ad_watch_seconds}
          dailyLimit={settings.ad_daily_limit}
          claimedToday={claimedToday}
        >
          <AdSlot placement="earn_page" className="border-0 bg-transparent" />
        </AdWatcher>
      )}

      {settings.earn_tasks_enabled ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Social tasks</h2>
          <TaskList tasks={tasks} />
        </section>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/40 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Task rewards are temporarily unavailable. Check back soon.
          </p>
        </div>
      )}
    </div>
  );
}
