import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { and, eq } from "drizzle-orm";
import { BRAND, clipDisplayTitle, truncate } from "@/lib/seo/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = BRAND;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: { id: string };
}) {
  const [clip] = await db
    .select()
    .from(clips)
    .where(and(eq(clips.id, params.id), eq(clips.isActive, true)))
    .limit(1);

  const [category] = clip
    ? await db
        .select()
        .from(categories)
        .where(eq(categories.id, clip.categoryId))
        .limit(1)
    : [];

  const title =
    clip && category
      ? truncate(clipDisplayTitle(clip, category), 80)
      : BRAND;
  const eyebrow = category?.name ?? "คลิป";

  const font = await readFile(
    path.join(process.cwd(), "src", "app", "_fonts", "Kanit-Bold.ttf")
  );

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
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.6)" }}>
          หมวด · {eyebrow}
        </div>

        <div
          style={{
            fontSize: 72,
            lineHeight: 1.15,
            fontWeight: 700,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              background: "linear-gradient(90deg,#ff3d7f 0%,#ff9f43 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {BRAND}
          </div>
          <div
            style={{
              fontSize: 22,
              padding: "6px 14px",
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
      fonts: [{ name: "Kanit", data: font, style: "normal", weight: 700 }],
    }
  );
}
