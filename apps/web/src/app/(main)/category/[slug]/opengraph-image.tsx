import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { and, eq, count } from "drizzle-orm";
import { BRAND } from "@/lib/seo/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = `หมวดหมู่ - ${BRAND}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: { slug: string };
}) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.slug, params.slug), eq(categories.isActive, true)))
    .limit(1);

  const name = category?.name ?? "หมวดหมู่";

  let clipCount = 0;
  if (category) {
    const [row] = await db
      .select({ c: count() })
      .from(clips)
      .where(and(eq(clips.categoryId, category.id), eq(clips.isActive, true)));
    clipCount = Number(row?.c ?? 0);
  }

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
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.55)" }}>
          หมวดหมู่ · {BRAND}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 1.1,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {name}
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 40,
              color: "rgba(255,255,255,0.75)",
            }}
          >
            {clipCount.toLocaleString("th-TH")} คลิป อัปเดตใหม่ทุกวัน
          </div>
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
