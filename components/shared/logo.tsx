import { cn } from "@/lib/utils";

/**
 * Inline vector mark — a rising trend line piercing an arrowhead, on a
 * violet→cyan→fuchsia disc. Kept inline (not an <Image>) so it is pixel-sharp
 * from a 32px favicon to hero sizes, carries no raster payload, and avoids the
 * `sharp` blur-placeholder path that has no arm64 binding at build time.
 *
 * The gradient id is fixed: identical <linearGradient> defs may repeat when the
 * logo renders more than once per page, and every browser resolves url(#id) to
 * the first match, so repeated identical ids render correctly.
 */
function BrandMark({ px, className }: { px: number; className?: string }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 40 40"
      role="img"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="ngpMark" x1="5" y1="4" x2="35" y2="37" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#933df5" />
          <stop offset="0.52" stopColor="#06d0f9" />
          <stop offset="1" stopColor="#f53dc7" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill="url(#ngpMark)" />
      <circle cx="20" cy="20" r="19" fill="none" stroke="#ffffff" strokeOpacity="0.16" />
      <path
        d="M9 26.5 16.5 20 22.5 23 30.5 12"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M23.5 12 H30.5 V19"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
      <BrandMark px={dims.px} className={cn("rounded-full ring-1 ring-inset ring-white/10", dims.box)} />

      {showText && (
        <span className={cn("truncate font-bold tracking-tight leading-none", dims.text)}>
          <span className="text-gradient">{first}</span>
          {rest && <span className="text-foreground">{rest}</span>}
        </span>
      )}
    </div>
  );
}
