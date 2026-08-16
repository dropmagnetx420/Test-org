"use client";

import type { CSSProperties, ReactNode } from "react";
import { m, useReducedMotion, type Variants } from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Framer-motion entrance primitives. The API (FadeIn / StaggerGrid /
 * StaggerItem) matches the earlier CSS-only version so call sites are
 * unchanged. Everything animates once on scroll-in and collapses to an
 * opacity-only fade under `prefers-reduced-motion`. Never wrap the hero <h1>
 * (LCP element) in these — keep that server-rendered and static.
 */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </m.div>
  );
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

const itemVariantsReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

export function StaggerGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-8% 0px" }}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const reduce = useReducedMotion();
  return (
    <m.div className={className} style={style} variants={reduce ? itemVariantsReduced : itemVariants}>
      {children}
    </m.div>
  );
}
