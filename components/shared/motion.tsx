import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * CSS-only entrance animations. These were framer-motion `whileInView`
 * components, which forced every consumer into the client bundle and left
 * content at opacity 0 until hydration — bad for LCP and for crawlers that
 * never run the observer. The `reveal` keyframe animates from a visible-by-
 * default stylesheet rule, so text is present in the initial HTML either way.
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
  return (
    <div className={cn("reveal", className)} style={{ animationDelay: `${delay * 1000}ms` }}>
      {children}
    </div>
  );
}

export function StaggerGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("stagger", className)}>{children}</div>;
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
  return (
    <div className={cn("reveal", className)} style={style}>
      {children}
    </div>
  );
}
