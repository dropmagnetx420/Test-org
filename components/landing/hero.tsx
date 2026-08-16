import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/shared/animated-number";

const TRUST = [
  { icon: ShieldCheck, label: "Row-level security" },
  { icon: Zap, label: "Instant settlement" },
  { icon: Sparkles, label: "Cancel anytime" },
];

export function Hero({
  totalVolume,
  openMarkets,
  traders,
}: {
  totalVolume: number;
  openMarkets: number;
  traders: number;
}) {
  const stats = [
    { label: "Total volume", value: totalVolume, kind: "compact" as const },
    { label: "Open markets", value: openMarkets, kind: "int" as const },
    { label: "Traders", value: traders, kind: "compact" as const },
  ];

  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-16 sm:px-6 sm:pt-24 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <p className="reveal mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          {openMarkets} live markets across 5 sports
        </p>

        {/* No entrance animation: this is the LCP element and must paint immediately. */}
        <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          Trade the outcome of <span className="text-gradient">every match</span>
        </h1>

        <p
          className="reveal mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg"
          style={{ animationDelay: "80ms" }}
        >
          Buy YES or NO on football, cricket, basketball, tennis and esports. Prices move with the
          crowd, positions settle the moment a market resolves, and you can cancel any open trade
          before the whistle.
        </p>

        <div
          className="reveal mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "140ms" }}
        >
          <Button asChild size="xl" variant="gradient" className="w-full sm:w-auto">
            <Link href="/register">
              Start predicting
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="xl" variant="glass" className="w-full sm:w-auto">
            <Link href="/markets">Explore markets</Link>
          </Button>
        </div>

        <ul
          className="reveal mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
          style={{ animationDelay: "200ms" }}
        >
          {TRUST.map(({ icon: Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-1.5">
              <Icon className="size-3.5 text-primary" />
              {label}
            </li>
          ))}
        </ul>

        <dl
          className="reveal mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-2 sm:mt-14 sm:gap-3"
          style={{ animationDelay: "260ms" }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="glass rounded-xl px-2 py-3 transition-colors hover:border-primary/40 sm:px-3 sm:py-4"
            >
              <dd className="font-mono text-lg font-semibold tabular-nums sm:text-2xl">
                <AnimatedNumber value={stat.value} kind={stat.kind} />
              </dd>
              <dt className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
