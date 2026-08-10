import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/constants";

export const alt = `${SITE_NAME} — Sports Prediction Markets`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Generated rather than a static file so it always matches the brand colours,
 * and no font is loaded — Satori's built-in sans keeps this off the build's
 * critical path. Every element needs an explicit `display: flex`.
 *
 * The mark is inlined as a data URL because Satori has no request context to
 * resolve `/logo-mark.png` against during a static prerender.
 */
export default async function OpengraphImage() {
  const mark = await readFile(join(process.cwd(), "public/logo-mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: "#0b0a13",
          backgroundImage:
            "radial-gradient(900px 600px at 12% 4%, rgba(139,64,245,0.42), transparent 62%), radial-gradient(760px 520px at 92% 30%, rgba(26,214,240,0.26), transparent 64%)",
          color: "#f4f5fa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 42 }}>
          <div
            style={{
              display: "flex",
              width: 88,
              height: 88,
              borderRadius: 44,
              border: "2px solid rgba(217,153,84,0.55)",
              boxShadow: "0 0 0 8px rgba(217,153,84,0.08)",
            }}
          >
            <img src={markSrc} width={84} height={84} alt="" style={{ borderRadius: 42 }} />
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
            {SITE_NAME}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 82,
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: -2.5,
            maxWidth: 940,
          }}
        >
          Trade the outcome of every match
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 30,
            fontSize: 30,
            lineHeight: 1.35,
            color: "#a5a3b8",
            maxWidth: 880,
          }}
        >
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    size
  );
}
