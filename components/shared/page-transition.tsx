"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { m, useReducedMotion } from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Enter-only page transition. Keyed on the pathname so the content remounts and
 * replays on every navigation; the surrounding layout (header, nav, footer)
 * stays mounted because this wraps only `{children}`. Enter-only — no
 * AnimatePresence exit — sidesteps the RSC unmount jank that plagues exit
 * animations in the App Router.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <m.div
      key={pathname}
      initial={{ opacity: 0, y: reduce ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
    >
      {children}
    </m.div>
  );
}
