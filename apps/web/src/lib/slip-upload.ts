const MAX_FILE = 4 * 1024 * 1024;
const MAX_BODY = MAX_FILE + 16 * 1024;

/** Bound the stream even when Content-Length is missing or forged. */
export async function readSlipUpload(req: Request) {
  if (Number(req.headers.get("content-length")) > MAX_BODY) throw new Error("ไฟล์สลิปต้องไม่เกิน 4 MB");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("กรุณาเลือกรูปสลิป");
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY) { await reader.cancel(); throw new Error("ไฟล์สลิปต้องไม่เกิน 4 MB"); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const form = await new Response(Buffer.concat(parts), { headers: { "content-type": req.headers.get("content-type") ?? "" } }).formData();
  const file = form.get("slip");
  if (!(file instanceof File) || !file.size) throw new Error("กรุณาเลือกรูปสลิปที่ไม่ว่าง");
  if (file.size > MAX_FILE) throw new Error("ไฟล์สลิปต้องไม่เกิน 4 MB");
  const buffer = Buffer.from(await file.arrayBuffer());
  // Do not trust the extension or client MIME. The provider decodes the image/QR.
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return { buffer, mime: "image/jpeg", ext: "jpg" };
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { buffer, mime: "image/png", ext: "png" };
  if (["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString())) return { buffer, mime: "image/gif", ext: "gif" };
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return { buffer, mime: "image/webp", ext: "webp" };
  throw new Error("อ่านรูปไม่ได้ กรุณาใช้ภาพหน้าจอสลิป หรือไฟล์ JPG / PNG / GIF / WEBP");
}
