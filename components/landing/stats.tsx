import { Activity, BarChart3, Trophy, Users } from "lucide-react";
import { FadeIn, StaggerGrid, StaggerItem } from "@/components/shared/motion";
import { AnimatedNumber } from "@/components/shared/animated-number";

interface StatsProps {
  totalVolume: number;
  totalTrades: number;
  totalUsers: number;
  resolvedMarkets: number;
}

export function Stats({ totalVolume, totalTrades, totalUsers, resolvedMarkets }: StatsProps) {
  const items = [
    { icon: BarChart3, label: "Total volume traded", value: totalVolume, suffix: " USDG" },
    { icon: Activity, label: "Predictions placed", value: totalTrades },
    { icon: Users, label: "Registered traders", value: totalUsers },
    { icon: Trophy, label: "Markets settled", value: resolvedMarkets },
  ];

  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <FadeIn>
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built on <span className="text-gradient">real activity</span>
            </h2>
            <p className="mt-3 text-muted-foreground">
              Every number below is read live from the exchange.
            </p>
          </div>
        </FadeIn>

        <StaggerGrid className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {items.map(({ icon: Icon, label, value, suffix }) => (
            <StaggerItem key={label}>
              <div className="glass relative overflow-hidden rounded-xl p-4 text-center sm:p-6">
                <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/20 blur-2xl" />
                <div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-cyan-500/10 text-primary sm:size-11">
                  <Icon className="size-5" />
                </div>
                <p className="font-mono text-lg font-semibold tabular-nums sm:text-2xl lg:text-3xl">
                  <AnimatedNumber value={value} kind="compact" />
                  {suffix}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{label}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </div>
    </section>
  );
}
