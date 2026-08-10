import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The emblem crop, not the full seal: the wordmark inside the seal is illegible
 * below ~64px and would compete with the `siteName` text rendered beside it.
 *
 * Referenced by path rather than statically imported — a static import makes
 * webpack generate a blur placeholder through `sharp`, which has no native
 * binding on arm64 and breaks the build there. Dimensions are fixed anyway.
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
  logoUrl,
  siteName = "NextGen Predict",
}: {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
  logoUrl?: string | null;
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
        src={logoUrl ?? BRAND_MARK}
        alt={siteName}
        width={dims.px}
        height={dims.px}
        quality={82}
        loading="eager"
        className={cn(
          "shrink-0 object-contain",
          // The bundled mark is a circular seal, so it gets a matching frame.
          // An operator-uploaded logo may be any aspect ratio — clipping it to
          // a circle would cut the edges off.
          logoUrl ? "rounded-xl" : "rounded-full ring-1 ring-inset ring-amber-500/25",
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
