import Link from "next/link";
import { ArrowRight, Coins, HandCoins, Megaphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/shared/motion";

const WAYS = [
  {
    icon: Coins,
    title: "Social tasks",
    description: "Follow, join or share — approved payouts land in your wallet.",
  },
  {
    icon: Megaphone,
    title: "Watch ads",
    description: "A fixed reward per view, up to a daily cap that resets every day.",
  },
  {
    icon: Users,
    title: "Invite friends",
    description: "Take a cut of every trade your referrals place, for as long as they trade.",
  },
];

/** The earn flow was previously reachable only from deep inside the dashboard,
 *  so it gets its own band on the landing page. */
export function EarnCta() {
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="border-gradient-flow mx-auto max-w-7xl overflow-hidden rounded-2xl bg-card/40 backdrop-blur-xl sm:rounded-3xl">
        <div className="grid gap-6 p-5 sm:gap-8 sm:p-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <FadeIn>
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
              <HandCoins className="size-3.5" />
              No deposit needed
            </p>

            <h2 className="mt-4 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
              Build a balance <span className="text-gradient">before you trade</span>
            </h2>

            <p className="mt-2 text-pretty text-sm text-muted-foreground sm:text-base">
              Every account gets the earn hub: finish quick tasks, watch a few ads, and bring
              friends in. Rewards credit straight to your wallet and can be traded immediately.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="gradient">
                <Link href="/earn">
                  Open earn hub
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="glass">
                <Link href="/referrals">Referral programme</Link>
              </Button>
            </div>
          </FadeIn>

          <FadeIn delay={0.12}>
            <ul className="grid gap-3 sm:grid-cols-3 lg:gap-4">
              {WAYS.map(({ icon: Icon, title, description }) => (
                <li
                  key={title}
                  className="lift rounded-2xl border border-border/60 bg-background/40 p-4 transition-colors hover:border-primary/40"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/25">
                    <Icon className="size-4" />
                  </span>
                  <p className="mt-3 text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
                </li>
              ))}
            </ul>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
