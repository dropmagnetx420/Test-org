import Link from "next/link";
import { ArrowRight, Coins, Megaphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const WAYS = [
  {
    icon: Coins,
    title: "Social tasks",
    description: "Follow, join or share — approved payouts land in your wallet.",
    badge: "Instant payout",
  },
  {
    icon: Megaphone,
    title: "Watch ads",
    description: "A fixed reward per view, up to a daily cap that resets every day.",
    badge: "Daily reset",
  },
  {
    icon: Users,
    title: "Invite friends",
    description: "Take a cut of every trade your referrals place, for as long as they trade.",
    badge: "Lifetime cut",
  },
];

/** The earn flow was previously reachable only from deep inside the dashboard,
 *  so it gets its own high-visibility gold band on the landing page. */
export function EarnCta() {
  return (
    <section aria-labelledby="earn-heading" className="px-4 py-14 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-7xl">
        {/* Warm glow bleeding out from behind the card sets it apart from the
            violet sections around it. */}
        <div
          aria-hidden
          className="absolute -inset-4 rounded-[2rem] bg-[radial-gradient(60%_80%_at_50%_50%,rgba(217,119,6,0.14),transparent_70%)]"
        />

        <div className="shadow-3d-gold relative overflow-hidden rounded-3xl border border-amber-500/25 bg-card/50 backdrop-blur-xl">
          <span
            aria-hidden
            className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent"
          />

          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 shadow-[0_2px_10px_-2px_rgba(217,119,6,0.5)]">
                <Coins className="size-3.5" />
                No deposit needed
              </p>

              <h2
                id="earn-heading"
                className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl"
              >
                Build a balance <span className="text-gradient-gold">before you trade</span>
              </h2>

              <p className="mt-3 text-pretty text-sm text-muted-foreground sm:text-base">
                Every account gets the earn hub: finish quick tasks, watch a few ads, and bring
                friends in. Rewards credit straight to your wallet and can be traded immediately.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="border border-amber-400/40 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-[0_4px_20px_-4px_rgba(217,119,6,0.7)] hover:from-amber-400 hover:to-orange-400"
                >
                  <Link href="/earn">
                    Open earn hub
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="glass">
                  <Link href="/referrals">Referral programme</Link>
                </Button>
              </div>
            </div>

            <ul className="grid gap-3 sm:grid-cols-3 lg:gap-4">
              {WAYS.map(({ icon: Icon, title, description, badge }) => (
                <li
                  key={title}
                  className="card-3d shadow-3d rounded-2xl border border-amber-500/20 bg-background/50 p-4 hover:border-amber-400/50"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-600/15 text-amber-300 ring-1 ring-inset ring-amber-400/30 shadow-[0_2px_8px_-2px_rgba(217,119,6,0.5)]">
                    <Icon className="size-4.5" />
                  </span>
                  <p className="mt-3 text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                  <p className="mt-2.5 inline-flex rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                    {badge}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
