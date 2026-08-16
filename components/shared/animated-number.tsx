"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { cn, formatCompact, formatCurrency } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const FORMATTERS = {
  int: (n: number) => Math.round(n).toLocaleString(),
  compact: (n: number) => formatCompact(n),
  currency: (n: number) => formatCurrency(n),
} as const;

/**
 * Rolls a number up to `value` when it scrolls into view. SSR renders the
 * final formatted value as text, so there is no layout shift and crawlers see
 * the real figure; the count-up only runs client-side. The frame loop writes
 * straight to the DOM node (not React state) to keep it cheap.
 *
 * Pass `kind` (a serializable string) from Server Components; pass a `format`
 * function only from Client Components — functions can't cross the RSC boundary.
 */
export function AnimatedNumber({
  value,
  from = 0,
  duration = 1.1,
  kind = "int",
  format,
  className,
}: {
  value: number;
  from?: number;
  duration?: number;
  kind?: keyof typeof FORMATTERS;
  format?: (n: number) => string;
  className?: string;
}) {
  const resolved = format ?? FORMATTERS[kind];
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-8% 0px" });
  const reduce = useReducedMotion();
  const formatRef = useRef(resolved);

  useEffect(() => {
    formatRef.current = resolved;
  }, [resolved]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (reduce || !inView) {
      el.textContent = formatRef.current(value);
      return;
    }

    const controls = animate(from, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => {
        el.textContent = formatRef.current(v);
      },
    });
    return () => controls.stop();
  }, [inView, value, from, duration, reduce]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {resolved(value)}
    </span>
  );
}
