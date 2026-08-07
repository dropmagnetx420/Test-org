"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function format(ms: number) {
  if (ms <= 0) return "Closed";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function Countdown({
  to,
  className,
  showIcon = true,
}: {
  to: string;
  className?: string;
  showIcon?: boolean;
}) {
  const target = new Date(to).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const urgent = remaining > 0 && remaining < 3_600_000;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-xs tabular-nums",
        urgent ? "text-amber-400" : "text-muted-foreground",
        className
      )}
      suppressHydrationWarning
    >
      {showIcon && <Clock className="size-3" />}
      {format(remaining)}
    </span>
  );
}
