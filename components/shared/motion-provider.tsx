"use client";

import type { ReactNode } from "react";
import { LazyMotion, MotionConfig, domMax } from "framer-motion";

/**
 * Loads framer-motion's full DOM feature set (animations, gestures, layout,
 * exit) lazily and code-split, so `m.*` components across the app ride one
 * shared bundle that never blocks first paint. `strict` throws if any code
 * reaches for the heavyweight `motion.*` API instead of `m.*`.
 *
 * `reducedMotion="user"` makes every m-component honor the OS setting: under
 * "reduce" framer drops transform and layout movement while keeping opacity
 * fades, so we get accessible motion globally without per-component guards.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
