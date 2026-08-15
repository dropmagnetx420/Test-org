import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand badge rendered from the raster logo at `public/logo.png` — a circular
 * emblem with the wordmark and compass baked in. Shown through <Image unoptimized>
 * with a string src (never a static import) so the `sharp` blur-placeholder path,
 * which has no arm64 binding at build time, is never invoked. `object-contain`
 * keeps the whole disc in frame at every size, so it is never cropped.
 */
function BrandMark({ px, className }: { px: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      aria-hidden="true"
      width={px}
      height={px}
      unoptimized
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/** First word is gradient-filled, the rest plain — matches the mark. */
function splitName(name: string): [string, string] {
  const trimmed = name.trim();
  const space = trimmed.indexOf(" ");
  return space === -1 ? [trimmed, ""] : [trimmed.slice(0, space), trimmed.slice(space)];
}

export function Logo({
  size = "md",
  showText = true,
  className,
  siteName = "NextGen Predict",
}: {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
  siteName?: string;
}) {
  const dims = {
    sm: { box: "size-8", text: "text-lg", px: 32 },
    md: { box: "size-9 sm:size-10", text: "text-lg sm:text-xl", px: 40 },
    lg: { box: "size-14", text: "text-3xl", px: 56 },
  }[size];

  const [first, rest] = splitName(siteName);

  return (
    <div className={cn("flex min-w-0 items-center gap-2 sm:gap-2.5", className)}>
      <BrandMark px={dims.px} className={dims.box} />

      {showText && (
        <span className={cn("truncate font-bold tracking-tight leading-none", dims.text)}>
          <span className="text-gradient">{first}</span>
          {rest && <span className="text-foreground">{rest}</span>}
        </span>
      )}
    </div>
  );
}
