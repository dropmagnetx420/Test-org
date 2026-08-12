import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The full brand seal (compass + wordmark). It is circular art on black, so it
 * renders cleanly as a coin-style badge at header sizes; the `siteName` text
 * beside it carries legibility at small sizes.
 *
 * Referenced by path rather than statically imported — a static import makes
 * webpack generate a blur placeholder through `sharp`, which has no native
 * binding on arm64 and breaks the build there. Dimensions are fixed anyway.
 *
 * Deliberately the only source of the mark: an operator-uploadable logo meant
 * every deployment carried a stale override in `site_settings.logo_url` that
 * silently beat the shipped art.
 */
const BRAND_MARK = "/logo.png";

/** First word is gold-gradient-filled, the rest plain — matches the seal. */
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
      <span className={cn("logo-halo grid shrink-0 place-items-center", dims.box)}>
        <Image
          src={BRAND_MARK}
          alt={siteName}
          width={dims.px}
          height={dims.px}
          quality={82}
          priority
          className={cn(
            "relative rounded-full object-contain",
            "ring-1 ring-inset ring-amber-400/40",
            "drop-shadow-[0_2px_8px_rgba(217,119,6,0.45)]",
            dims.box
          )}
        />
      </span>

      {showText && (
        <span className={cn("font-bold tracking-tight leading-none", dims.text)}>
          <span className="text-gradient-gold drop-shadow-[0_1px_4px_rgba(217,119,6,0.35)]">
            {first}
          </span>
          {rest && <span className="text-foreground/90">{rest}</span>}
        </span>
      )}
    </div>
  );
}
