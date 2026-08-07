import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: "primary" | "accent" | "success" | "warning" | "destructive";
  className?: string;
}

const ACCENTS: Record<string, string> = {
  primary: "from-primary/25 to-primary/5 text-primary",
  accent: "from-cyan-500/25 to-cyan-500/5 text-cyan-400",
  success: "from-emerald-500/25 to-emerald-500/5 text-emerald-400",
  warning: "from-amber-500/25 to-amber-500/5 text-amber-400",
  destructive: "from-red-500/25 to-red-500/5 text-red-400",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "primary",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("glass overflow-hidden transition-colors hover:border-primary/40", className)}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate font-mono text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br",
              ACCENTS[accent]
            )}
          >
            <Icon className="size-5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
