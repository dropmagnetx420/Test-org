import Image from "next/image";
import { FadeIn } from "@/components/shared/motion";
import type { Partner } from "@/types/database";

export function Partners({ partners }: { partners: Partner[] }) {
  if (partners.length === 0) return null;

  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <FadeIn>
          <p className="mb-8 text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Trusted by our partners
          </p>
        </FadeIn>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {partners.map((partner) => {
            const inner = (
              <div className="glass flex h-full flex-col items-center justify-center gap-2 rounded-xl px-4 py-6 transition-colors hover:border-primary/40">
                <div className="relative size-10 shrink-0">
                  {/* Operators paste any logo URL, so the host is never in `remotePatterns`
                      and the optimizer would 400. */}
                  <Image
                    src={partner.logo_url}
                    alt={partner.name}
                    fill
                    sizes="40px"
                    className="object-contain opacity-80 transition-opacity hover:opacity-100"
                    unoptimized
                  />
                </div>
                <span className="text-center text-xs font-medium text-muted-foreground">
                  {partner.name}
                </span>
              </div>
            );

            return partner.website_url ? (
              <a
                key={partner.id}
                href={partner.website_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            ) : (
              <div key={partner.id}>{inner}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
