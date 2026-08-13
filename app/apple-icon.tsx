import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Generated rather than a static PNG so it always matches the shipped mark and
 * needs no arm64 `sharp` binding at build time — resvg rasterises the vector.
 * The disc sits on an opaque dark tile because iOS composites apple-touch-icons
 * onto the home screen with no transparency and rounds the corners itself.
 */
export default async function AppleIcon() {
  const mark = await readFile(join(process.cwd(), "public/logo-mark.svg"), "utf8");
  const markSrc = `data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0a13",
        }}
      >
        <img src={markSrc} width={140} height={140} alt="" />
      </div>
    ),
    size
  );
}
