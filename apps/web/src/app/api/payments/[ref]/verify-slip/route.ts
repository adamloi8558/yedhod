import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@kodhom/db";
import { payments, pricingPlans, subscriptions, adminAuditLogs } from "@kodhom/db/schema";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";
import { uploadBuffer } from "@kodhom/r2";
import { verifyBankSlip, slipRuleError, slipRuleMessages } from "@kodhom/easyslip";
import { getEasySlipConfig } from "@/lib/payment-config";
import { readSlipUpload } from "@/lib/slip-upload";

const reply = (error: string, code: string, status = 400, manualReview = false) =>
  NextResponse.json({ error, code, manualReview }, { status });

export async function POST(req: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const session = await getSession();
  if (!session?.user) return reply("กรุณาเข้าสู่ระบบ", "UNAUTHORIZED", 401);
  if (req.headers.get("sec-fetch-site") === "cross-site") return reply("คำขอไม่ถูกต้อง", "BAD_ORIGIN", 403);
  const { ref: id } = await params;
  const [owned] = await db.select().from(payments).where(and(eq(payments.id, id), eq(payments.userId, session.user.id))).limit(1);
  if (!owned) return reply("ไม่พบรายการชำระเงิน", "NOT_FOUND", 404);
  if (owned.provider !== "easyslip") return reply("รายการนี้ไม่รองรับการตรวจสลิป", "BAD_PROVIDER");
  if (owned.status === "completed") return NextResponse.json({ success: true });
  if (owned.status === "failed") return reply("รายการนี้ถูกปฏิเสธ กรุณาติดต่อแอดมิน", "REJECTED", 409);
  let upload: Awaited<ReturnType<typeof readSlipUpload>>;
  try { upload = await readSlipUpload(req); }
  catch (error) { return reply(error instanceof Error ? error.message : "อ่านไฟล์ไม่ได้ กรุณาเลือกรูปใหม่", "INVALID_FILE"); }
  const cfg = await getEasySlipConfig();
  // Save the evidence even when the provider is unavailable or unconfigured.
  try {
    return await db.transaction(async (tx) => {
      // One payment operation per user across all server replicas; do not queue API calls.
      const locks = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtextextended(${"payment:" + session.user.id}, 0)) as locked`);
      if (!locks[0]?.locked) return reply("กำลังตรวจรายการอยู่ กรุณารอสักครู่", "BUSY", 429);
      const [payment] = await tx.select().from(payments).where(eq(payments.id, id)).for("update").limit(1);
      if (payment.status === "completed") return NextResponse.json({ success: true });
      if (payment.status === "failed") return reply("รายการนี้ถูกปฏิเสธ กรุณาติดต่อแอดมิน", "REJECTED", 409);
      const [recent] = await tx.select().from(adminAuditLogs).where(and(
        eq(adminAuditLogs.targetType, "payment"), eq(adminAuditLogs.targetId, id),
        eq(adminAuditLogs.action, "payment.verify"), gt(adminAuditLogs.createdAt, new Date(Date.now() - 30_000))
      )).orderBy(desc(adminAuditLogs.createdAt)).limit(1);
      if (recent) return reply("กรุณารอ 30 วินาทีก่อนตรวจสลิปอีกครั้ง", "RATE_LIMIT", 429);
      const hash = createHash("sha256").update(upload.buffer).digest("hex");
      const slipKey = `slips/${id}/${hash}.${upload.ext}`;
      const record = async (code: string, extra: Record<string, unknown> = {}) => {
        await tx.insert(adminAuditLogs).values({ id: nanoid(), adminId: null, action: "payment.verify", targetType: "payment", targetId: id,
          metadata: { code, slipKey, sha256: hash, ...extra } });
      };
      try { await uploadBuffer(slipKey, upload.buffer, upload.mime, upload.buffer.length, AbortSignal.timeout(20_000)); }
      catch { await record("STORAGE_ERROR"); return reply("บันทึกสลิปไม่ได้ กรุณาลองส่งใหม่ ไม่ต้องโอนซ้ำ", "STORAGE_ERROR", 503); }
      await tx.update(payments).set({ slipImageR2Key: slipKey, status: "pending" }).where(eq(payments.id, id));
      const review = async (code: string, message: string, extra: Record<string, unknown> = {}) => {
        await record(code, extra);
        return reply(message, code, 422, true);
      };
      if (!cfg?.apiKey) return review("MISSING_API_KEY", "บันทึกสลิปแล้ว ระบบตรวจสลิปยังไม่พร้อม กรุณาติดต่อแอดมิน ไม่ต้องโอนซ้ำ");
      const snapshot = payment.accountSnapshot as { bankCode?: string; accountNumber?: string } | null;
      if (!snapshot?.bankCode || !snapshot.accountNumber) return review("MISSING_ACCOUNT", "บันทึกสลิปแล้ว กรุณารอแอดมินตรวจสอบข้อมูลบัญชี");
      const result = await verifyBankSlip({ apiKey: cfg.apiKey, imageBuffer: upload.buffer, imageMime: upload.mime,
        imageFilename: `slip.${upload.ext}`, matchAmount: Number(payment.amount), checkDuplicate: true });
      if (!result.ok) return review(result.code, result.message);
      const code = slipRuleError(result.data, { amount: payment.amount, bankCode: snapshot.bankCode,
        accountNumber: snapshot.accountNumber, createdAt: payment.createdAt, expiresAt: payment.expiresAt });
      if (code) return review(code, slipRuleMessages[code]);
      const transRef = result.data.rawSlip.transRef.trim();
      // Serialize the same bank transaction across different users and orders.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"slip:" + transRef}, 0))`);
      const [used] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.easyslipTransRef, transRef)).limit(1);
      const [granted] = await tx.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.paymentRef, transRef)).limit(1);
      if ((used && used.id !== id) || granted) return review("DUPLICATE_SLIP", "ธุรกรรมนี้ผูกกับรายการอื่นแล้ว กรุณาติดต่อแอดมิน ไม่ต้องโอนซ้ำ", { transRef });
      // A provider duplicate with no local ownership is ambiguous (including legacy manual grants).
      // Never delete evidence or automatically credit an unclaimed duplicate.
      if (result.data.isDuplicate && payment.easyslipTransRef !== transRef) {
        return review("DUPLICATE_REVIEW", "บันทึกสลิปแล้ว พบประวัติการตรวจสลิปนี้ กรุณารอแอดมินตรวจสอบ ไม่ต้องโอนซ้ำ", { transRef });
      }
      const [plan] = await tx.select().from(pricingPlans).where(eq(pricingPlans.id, payment.pricingPlanId)).limit(1);
      if (!plan) return review("MISSING_PLAN", "บันทึกสลิปแล้ว กรุณาติดต่อแอดมินเพื่อตรวจแพ็กเกจ");
      const now = new Date();
      await tx.update(payments).set({ status: "completed", paidAt: now, easyslipTransRef: transRef }).where(eq(payments.id, id));
      await tx.insert(subscriptions).values({ id: nanoid(), userId: payment.userId, pricingPlanId: payment.pricingPlanId,
        status: "active", startDate: now, endDate: plan.durationDays >= 36500 ? null : new Date(now.getTime() + plan.durationDays * 86400000),
        amountPaid: payment.amount, paymentRef: transRef });
      await record("COMPLETED", { transRef });
      return NextResponse.json({ success: true });
    });
  } catch (error) {
    // Only log identifiers, never provider credentials or raw slip/customer data.
    console.error("[verify-slip] failed", { paymentId: id, error: error instanceof Error ? error.name : "UnknownError" });
    return reply("ยังยืนยันผลไม่ได้ กรุณาตรวจสถานะรายการหรือติดต่อแอดมิน ไม่ต้องโอนซ้ำ", "INTERNAL_ERROR", 503);
  }
}
