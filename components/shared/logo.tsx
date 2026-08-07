"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Logo({
  size = "md",
  showText = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}) {
  const dims = {
    sm: { box: "size-8", text: "text-lg", icon: 16 },
    md: { box: "size-10", text: "text-xl", icon: 20 },
    lg: { box: "size-14", text: "text-3xl", icon: 28 },
  }[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <motion.div
        className={cn(
          "relative grid place-items-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-500 shadow-lg shadow-violet-600/40",
          dims.box
        )}
        whileHover={{ scale: 1.08, rotate: 6 }}
        transition={{ type: "spring", stiffness: 380, damping: 18 }}
      >
        <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 blur-md opacity-60 animate-glow" />
        <svg
          width={dims.icon}
          height={dims.icon}
          viewBox="0 0 24 24"
          fill="none"
          className="relative z-10"
          aria-hidden="true"
        >
          <path
            d="M3 17L9 11L13 15L21 7"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M16 7H21V12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>

      {showText && (
        <span className={cn("font-bold tracking-tight leading-none", dims.text)}>
          <span className="text-gradient">NextGen</span>
          <span className="text-foreground"> Predict</span>
        </span>
      )}
    </div>
  );
}
