import { formatDuration } from "@kodhom/ui/lib/utils";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://xn--l3ca4bxbygoa7a.com";
export const BRAND = "เย็ดโหด";
export const BRAND_SUFFIX = ` | ${BRAND}`;
export const BRAND_TAGLINE = "คลิปวิดีโอผู้ใหญ่คุณภาพ อัปเดตใหม่ทุกวัน";

export function absoluteUrl(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  return `${SITE_URL}${path}`;
}

export function canonical(path: string) {
  return {
    canonical: path,
    languages: {
      "th-TH": path,
      "x-default": path,
    },
  };
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

export function pageTitle(subject: string): string {
  const full = subject + BRAND_SUFFIX;
  return truncate(full, 70);
}

function formatThaiDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export interface ClipLike {
  id: string;
  duration?: number | null;
  createdAt: Date | string;
}

export interface CategoryLike {
  name: string;
  slug: string;
}

export function clipDisplayTitle(
  clip: ClipLike,
  category: Pick<CategoryLike, "name">
): string {
  const dur = clip.duration ? formatDuration(clip.duration) : null;
  const date = formatThaiDateShort(clip.createdAt);
  if (dur) {
    return `ดูคลิป${category.name} ความยาว ${dur} อัปเดต ${date}`;
  }
  return `ดูคลิป${category.name} อัปเดต ${date}`;
}

export function clipPageTitle(
  clip: ClipLike,
  category: Pick<CategoryLike, "name">
): string {
  return pageTitle(clipDisplayTitle(clip, category));
}

export function clipDescription(
  clip: ClipLike,
  category: Pick<CategoryLike, "name">
): string {
  const dur = clip.duration ? formatDuration(clip.duration) : "สั้น";
  const date = formatThaiDateShort(clip.createdAt);
  const text = `ชมคลิป${category.name}ความยาว ${dur} อัปเดต ${date} ที่ ${BRAND} คลิปวิดีโอคุณภาพสำหรับผู้ใหญ่อายุ 18+ อัปเดตใหม่ทุกวัน สมัครสมาชิก VIP เพื่อดูคลิปแบบไม่จำกัด`;
  return truncate(text, 155);
}

export function categoryTitle(name: string, page?: number): string {
  const base = page && page > 1 ? `หมวด${name} หน้า ${page}` : `หมวด${name}`;
  return pageTitle(base);
}

export function categoryDescription(
  category: { name: string; description?: string | null },
  clipCount: number
): string {
  if (category.description && category.description.trim().length > 30) {
    return truncate(category.description.trim(), 155);
  }
  const text = `ชมคลิปหมวด${category.name}ทั้งหมด ${clipCount.toLocaleString("th-TH")} คลิปที่ ${BRAND} อัปเดตใหม่ทุกวัน คุณภาพ HD พร้อมรับชมได้ทันทีหลังสมัครสมาชิก`;
  return truncate(text, 155);
}

export function adultMetaOther(): Record<string, string> {
  return {
    rating: "adult",
    RATING: "RTA-5042-1996-1400-1577-RTA",
    "content-rating": "Mature",
    "age-rating": "18+",
    ICRA: "nudity adult violence language",
  };
}
