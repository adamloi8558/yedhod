/**
 * Turn a raw scraped clip title (usually a filename with underscores +
 * timestamps) into a friendly display title. We prepend the category /
 * uploader name and strip the timestamp.
 *
 * Never returns the raw filename verbatim: if we can't derive anything
 * friendlier, we fall back to `${category} · คลิปที่ N`.
 */
export function prettyTitle(input: {
  rawTitle: string;
  categoryName: string;
  createdAt: Date | string | null | undefined;
  index?: number;
}): string {
  const { rawTitle, categoryName } = input;
  const created =
    input.createdAt instanceof Date
      ? input.createdAt
      : input.createdAt
        ? new Date(input.createdAt)
        : null;

  const cleaned = cleanRaw(rawTitle, categoryName);
  const date = created ? formatThaiDate(created) : null;

  if (cleaned && cleaned.length > 3) {
    return date ? `${cleaned} · ${date}` : cleaned;
  }
  const idxPart = input.index != null ? ` #${input.index}` : "";
  return date ? `${categoryName}${idxPart} · ${date}` : `${categoryName}${idxPart}`;
}

function cleanRaw(raw: string, categoryName: string): string {
  let s = (raw || "").trim();
  if (!s) return "";
  // strip timestamp patterns like _2026_06_07_04_45_30 or -2026-06-07
  s = s.replace(/[-_](19|20)\d{2}[-_](0?\d|1[0-2])[-_].*$/g, "");
  // strip trailing hash-like ids: 1710, 32chars hex etc.
  s = s.replace(/[-_][a-f0-9]{8,}$/i, "");
  // strip repeating category prefix if scraper embedded it (e.g. AngelLeeen_...)
  const catAlpha = categoryName.replace(/\s+/g, "").toLowerCase();
  if (catAlpha.length > 3 && s.replace(/\s+/g, "").toLowerCase().startsWith(catAlpha)) {
    s = s.slice(catAlpha.length).replace(/^[_\- ]+/, "");
  }
  // replace underscores with spaces
  s = s.replace(/_/g, " ").trim();
  if (!s) return categoryName;
  // Title-case first word
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}

const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function formatThaiDate(d: Date): string {
  const yearBE = d.getFullYear() + 543;
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${yearBE % 100}`;
}
