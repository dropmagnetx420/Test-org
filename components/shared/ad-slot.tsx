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

function AdCreative({ config }: { config: AdPlacementConfig }) {
  const id = `ad-${config.placement}`;

  if (config.provider === "admob") {
    if (!config.unit_id) return null;
    const [client] = config.unit_id.split("/");
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
          data-ad-slot={config.unit_id.split("/")[1] ?? ""}
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
    if (!config.script_url) return null;
    return (
      <>
        <div id={`atContainer-${config.placement}`} />
        <Script id={`${id}-loader`} strategy="lazyOnload" src={config.script_url} async />
      </>
    );
  }

  // start.io
  if (!config.script_url && !config.unit_id) return null;
  return (
    <>
      <div id={`startio-${config.placement}`} data-app-id={config.unit_id ?? ""} />
      {config.script_url && (
        <Script id={`${id}-loader`} strategy="lazyOnload" src={config.script_url} async />
      )}
    </>
  );
}
