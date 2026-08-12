import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The emblem crop, not the full seal: the wordmark inside the seal is illegible
 * below ~64px and would compete with the `siteName` text rendered beside it.
 *
 * Referenced by path rather than statically imported — a static import makes
 * webpack generate a blur placeholder through `sharp`, which has no native
 * binding on arm64 and breaks the build there. Dimensions are fixed anyway.
 *
 * Deliberately the only source of the mark: an operator-uploadable logo meant
 * every deployment carried a stale override in `site_settings.logo_url` that
 * silently beat the shipped art.
 */
const BRAND_MARK = "/logo-mark.png";

/** First word is gradient-filled, the rest plain — matches the original mark. */
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
    md: { box: "size-10", text: "text-xl", px: 40 },
    lg: { box: "size-14", text: "text-3xl", px: 56 },
  }[size];

  const [first, rest] = splitName(siteName);

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src={BRAND_MARK}
        alt={siteName}
        width={dims.px}
        height={dims.px}
        quality={82}
        priority
        className={cn(
          "shrink-0 rounded-full object-contain ring-1 ring-inset ring-amber-500/25",
          dims.box
        )}
      />

      {showText && (
        <span className={cn("font-bold tracking-tight leading-none", dims.text)}>
          <span className="text-gradient">{first}</span>
          {rest && <span className="text-foreground">{rest}</span>}
        </span>
      )}
    </div>
  );
}
