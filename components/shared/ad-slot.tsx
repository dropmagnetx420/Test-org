import Script from "next/script";
import { getAdPlacements } from "@/lib/queries";
import { getSettings } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { AdPlacementConfig, AdPlacementSlot } from "@/types/database";

/**
 * Renders a configured ad slot, or nothing when ads are off or the slot is
 * unconfigured. Scripts load lazily so an ad network can never block paint.
 */
export async function AdSlot({
  placement,
  className,
}: {
  placement: AdPlacementSlot;
  className?: string;
}) {
  const settings = await getSettings();
  if (!settings.ads_enabled) return null;

  const config = (await getAdPlacements())[placement];
  if (!config) return null;

  return (
    <aside
      className={cn(
        "overflow-hidden rounded-xl border border-border/50 bg-card/40",
        className
      )}
      aria-label="Advertisement"
    >
      <AdCreative config={config} />
    </aside>
  );
}

/** Only http(s) can be loaded; `new URL()` alone would also accept javascript:. */
function safeHttpUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, "https://example.invalid");
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Escapes a value for interpolation inside an HTML attribute. */
function attr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** `</script>` inside a JSON literal would close the enclosing block early. */
function json(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function AdCreative({ config }: { config: AdPlacementConfig }) {
  const id = `ad-${config.placement}`;

  if (config.provider === "admob") {
    if (!config.unit_id) return null;
    const [client, slot] = config.unit_id.split("/");
    return (
      <>
        <Script
          id={`${id}-loader`}
          strategy="lazyOnload"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`}
          crossOrigin="anonymous"
        />
        <ins
          className="adsbygoogle block"
          style={{ display: "block" }}
          data-ad-client={client}
          data-ad-slot={slot ?? ""}
          data-ad-format={config.format === "native" ? "fluid" : "auto"}
          data-full-width-responsive="true"
        />
        <Script id={`${id}-push`} strategy="lazyOnload">
          {`(adsbygoogle = window.adsbygoogle || []).push({});`}
        </Script>
      </>
    );
  }

  if (config.provider === "adsterra") {
    const src = safeHttpUrl(config.script_url);
    if (!src) return null;

    // Native banners append themselves into a container keyed by the unit.
    if (config.format === "native" && config.script_key) {
      return (
        <>
          <Script id={`${id}-loader`} strategy="lazyOnload" src={src} async data-cfasync="false" />
          <div id={`container-${config.script_key}`} />
        </>
      );
    }

    // Display banners need `atOptions` defined before invoke.js runs, and that
    // script builds itself with document.write — which erases the page when it
    // runs after parsing. An iframe gives it a document still being parsed, and
    // the sandbox keeps a third-party script off the parent DOM and cookies.
    if (config.script_key) {
      const width = config.width ?? 300;
      const height = config.height ?? 250;
      const options = json({
        key: config.script_key,
        format: "iframe",
        height,
        width,
        params: {},
      });

      return (
        <iframe
          title="Advertisement"
          className="mx-auto block border-0"
          width={width}
          height={height}
          loading="lazy"
          scrolling="no"
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden}</style></head><body><script>window.atOptions=${options};</script><script src="${attr(src)}"></script></body></html>`}
        />
      );
    }

    // Social bar and popunder: a bare script that attaches itself to the page.
    return <Script id={`${id}-loader`} strategy="lazyOnload" src={src} async />;
  }

  // start.io
  const src = safeHttpUrl(config.script_url);
  if (!src && !config.unit_id) return null;
  return (
    <>
      <div id={`startio-${config.placement}`} data-app-id={config.unit_id ?? ""} />
      {src && <Script id={`${id}-loader`} strategy="lazyOnload" src={src} async />}
    </>
  );
}
