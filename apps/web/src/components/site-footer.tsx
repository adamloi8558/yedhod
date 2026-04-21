import Link from "next/link";
import { cache } from "react";
import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { and, count, eq, asc } from "drizzle-orm";
import { BRAND } from "@/lib/seo/metadata";

const getTopCategories = cache(async () => {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      clipCount: count(clips.id),
    })
    .from(categories)
    .leftJoin(clips, and(eq(clips.categoryId, categories.id), eq(clips.isActive, true)))
    .where(eq(categories.isActive, true))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder))
    .limit(8);
  return rows;
});

export async function SiteFooter() {
  const topCats = await getTopCategories();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border/40 bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              หมวดหมู่ยอดนิยม
            </h3>
            <ul className="space-y-2 text-sm">
              {topCats.map((c: typeof topCats[number]) => (
                <li key={c.id}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">เกี่ยวกับ</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="text-muted-foreground transition-colors hover:text-foreground">
                  เกี่ยวกับ {BRAND}
                </Link>
              </li>
              <li>
                <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
                  หน้าแรก
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">บริการ</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/pricing" className="text-muted-foreground transition-colors hover:text-foreground">
                  แพ็กเกจสมาชิก
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-muted-foreground transition-colors hover:text-foreground" rel="nofollow">
                  เข้าสู่ระบบ
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-muted-foreground transition-colors hover:text-foreground" rel="nofollow">
                  สมัครสมาชิก
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">ข้อกำหนด</h3>
            <ul className="space-y-2 text-sm">
              <li className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                เฉพาะอายุ 18+
              </li>
              <li className="text-xs text-muted-foreground leading-relaxed">
                เว็บไซต์นี้ได้รับการรับรองภายใต้มาตรฐาน RTA
                (Restricted To Adults) เนื้อหาสำหรับผู้ใหญ่เท่านั้น
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border/40 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            © {year} <span className="font-semibold text-foreground">{BRAND}</span>{" "}
            — คลิปวิดีโอผู้ใหญ่คุณภาพสูง สงวนลิขสิทธิ์
          </div>
          <div>สำหรับผู้มีอายุ 18 ปีขึ้นไปเท่านั้น</div>
        </div>
      </div>
    </footer>
  );
}
