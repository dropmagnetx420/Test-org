import Link from "next/link";
import { SPORTS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function SportsNav({ counts }: { counts: Record<string, number> }) {
  return (
    <section className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SPORTS.map((sport) => (
          <Link
            key={sport.value}
            href={`/markets?sport=${sport.value}`}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl transition-colors hover:border-primary/50"
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-10",
                sport.gradient
              )}
            />
            <div className="relative flex items-center gap-3">
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-lg bg-gradient-to-br text-lg",
                  sport.gradient
                )}
              >
                {sport.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{sport.label}</p>
                <p className="text-xs text-muted-foreground">
                  {counts[sport.value] ?? 0} market{(counts[sport.value] ?? 0) === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
