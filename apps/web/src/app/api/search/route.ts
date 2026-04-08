import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { eq, and, ilike, desc, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json([]);
  }

  const pattern = `%${q}%`;

  const results = await db
    .select({
      id: clips.id,
      title: clips.title,
      description: clips.description,
      thumbnailR2Key: clips.thumbnailR2Key,
      duration: clips.duration,
      accessLevel: clips.accessLevel,
      categoryId: clips.categoryId,
      createdAt: clips.createdAt,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(clips)
    .innerJoin(categories, eq(clips.categoryId, categories.id))
    .where(
      and(
        eq(clips.isActive, true),
        or(
          ilike(clips.title, pattern),
          ilike(clips.description, pattern),
          ilike(categories.name, pattern)
        )
      )
    )
    .orderBy(desc(clips.createdAt))
    .limit(20);

  return NextResponse.json(results);
}
