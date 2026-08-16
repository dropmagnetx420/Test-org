"use client";

import { m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** The stacked implied-probability bar on the market page. Each segment grows
 *  from zero to its share on scroll-in; under reduced motion it renders at its
 *  final width with no transition. */
export function ProbabilityBar({
  segments,
}: {
  segments: { id: string; pct: number; className: string }[];
}) {
  const reduce = useReducedMotion();

  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary">
      {segments.map((segment, index) => (
        <m.div
          key={segment.id}
          className={cn("h-full", segment.className)}
          initial={{ width: reduce ? `${segment.pct}%` : "0%" }}
          whileInView={{ width: `${segment.pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE, delay: reduce ? 0 : index * 0.08 }}
        />
      ))}
    </div>
  );
}
