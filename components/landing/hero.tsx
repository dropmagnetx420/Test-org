"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCompact } from "@/lib/utils";

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
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 sm:pt-28 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary"
        >
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          {openMarkets} live markets across 5 sports
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl"
        >
          Trade the outcome of <span className="text-gradient">every match</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg"
        >
          Buy YES or NO on football, cricket, basketball, tennis and esports. Prices move with the
          crowd, positions settle the moment a market resolves, and you can cancel any open trade
          before the whistle.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.18 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.28 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
        >
          {TRUST.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <Icon className="size-3.5 text-primary" />
              {label}
            </span>
          ))}
        </motion.div>

        <motion.dl
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.34 }}
          className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-3"
        >
          {[
            { label: "Total volume", value: `${formatCompact(totalVolume)}` },
            { label: "Open markets", value: openMarkets.toLocaleString() },
            { label: "Traders", value: formatCompact(traders) },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-xl px-3 py-4">
              <dd className="font-mono text-xl font-semibold tabular-nums sm:text-2xl">
                {stat.value}
              </dd>
              <dt className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </dt>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
