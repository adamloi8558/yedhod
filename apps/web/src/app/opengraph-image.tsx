import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { BRAND, BRAND_TAGLINE } from "@/lib/seo/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = `${BRAND} - ${BRAND_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadFont() {
  const fontPath = path.join(
    process.cwd(),
    "src",
    "app",
    "_fonts",
    "Kanit-Bold.ttf"
  );
  return readFile(fontPath);
}

export default async function Image() {
  const font = await loadFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background:
            "linear-gradient(135deg,#0b0b0f 0%,#1a0e1f 55%,#3a0a2a 100%)",
          color: "#fff",
          fontFamily: "Kanit",
        }}
      >
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.55)" }}>
          เว็บไซต์สำหรับผู้มีอายุ 18 ปีขึ้นไป
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 140,
              fontWeight: 700,
              lineHeight: 1,
              background: "linear-gradient(90deg,#ff3d7f 0%,#ff9f43 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {BRAND}
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: 36,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {BRAND_TAGLINE}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ fontSize: 26, color: "rgba(255,255,255,0.6)" }}>
            คลิปคุณภาพ HD ไม่มีโฆษณา
          </div>
          <div
            style={{
              fontSize: 24,
              padding: "8px 16px",
              border: "2px solid rgba(255,255,255,0.4)",
              borderRadius: 12,
              color: "rgba(255,255,255,0.8)",
            }}
          >
            18+
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Kanit", data: font, style: "normal", weight: 700 },
      ],
    }
  );
}
