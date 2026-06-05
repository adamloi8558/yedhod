import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { payments, pricingPlans, subscriptions } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";
import { uploadBuffer } from "@kodhom/r2";
import {
  verifyBankSlip,
  tailMatches,
  type EasySlipSuccessData,
} from "@kodhom/easyslip";
import { getEasySlipConfig } from "@/lib/payment-config";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const STALE_GRACE_MS = 5 * 60 * 1000;

interface AccountSnapshot {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref: paymentId } = await params;

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  // Load payment + check ownership/state
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!payment || payment.userId !== session.user.id) {
    return NextResponse.json({ error: "ไม่พบรายการชำระเงิน" }, { status: 404 });
  }
  if (payment.provider !== "easyslip") {
    return NextResponse.json(
      { error: "รายการนี้ไม่รองรับการตรวจสลิป" },
      { status: 400 }
    );
  }
  if (payment.status === "completed") {
    return NextResponse.json(
      { error: "ชำระเงินรายการนี้ดำเนินการไปแล้ว" },
      { status: 409 }
    );
  }
  if (payment.status !== "pending") {
    return NextResponse.json(
      { error: "ไม่สามารถตรวจสลิปสำหรับรายการนี้ได้" },
      { status: 409 }
    );
  }
  if (payment.expiresAt && new Date(payment.expiresAt) < new Date()) {
    return NextResponse.json({ error: "หมดเวลาชำระเงิน" }, { status: 410 });
  }

  const snapshot = payment.accountSnapshot as AccountSnapshot | null;
  if (!snapshot) {
    return NextResponse.json(
      { error: "ระบบขัดข้อง (ไม่พบข้อมูลบัญชี)" },
      { status: 500 }
    );
  }

  // Pre-check Content-Length to avoid buffering a huge body just to reject it.
  // Content-Length isn't guaranteed; the file.size check below is the
  // definitive gate.
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_FILE_BYTES + 8 * 1024) {
    return NextResponse.json(
      { error: "ไฟล์สลิปต้องไม่เกิน 4 MB" },
      { status: 413 }
    );
  }

  // Parse multipart
  const form = await req.formData();
  const file = form.get("slip");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "กรุณาอัปโหลดสลิป" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "ไฟล์สลิปต้องไม่เกิน 4 MB" },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "รองรับเฉพาะไฟล์ภาพ JPG / PNG / GIF / WEBP" },
      { status: 400 }
    );
  }

  // Load plan for expected amount
  const [plan] = await db
    .select()
    .from(pricingPlans)
    .where(eq(pricingPlans.id, payment.pricingPlanId))
    .limit(1);
  if (!plan) {
    return NextResponse.json({ error: "ไม่พบแพ็กเกจ" }, { status: 404 });
  }
  const expectedAmount = parseFloat(plan.priceThb);

  // Get EasySlip API key
  const cfg = await getEasySlipConfig();
  if (!cfg?.apiKey) {
    return NextResponse.json(
      { error: "ระบบยังไม่ได้ตั้งค่า API Key (กรุณาติดต่อแอดมิน)" },
      { status: 503 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type.split("/")[1] ?? "bin";

  // Audit-trail: persist slip to R2 BEFORE calling EasySlip
  const slipKey = `slips/${paymentId}.${ext}`;
  try {
    await uploadBuffer(slipKey, buffer, file.type, buffer.length);
    await db
      .update(payments)
      .set({ slipImageR2Key: slipKey })
      .where(eq(payments.id, paymentId));
  } catch (err) {
    console.error("[verify-slip] R2 upload failed", err);
    // Continue anyway — verification is more important than audit trail
  }

  // Call EasySlip
  const result = await verifyBankSlip({
    apiKey: cfg.apiKey,
    imageBuffer: buffer,
    imageMime: file.type,
    imageFilename: file.name,
    matchAmount: expectedAmount,
    checkDuplicate: true,
  });

  if (!result.ok) {
    // Soft-fail: keep the slip + the payment, surface for admin review.
    // The previous behavior left the user with a rejected slip + a stale
    // payment record, so they would re-create a new record and re-upload
    // — duplicating themselves into the queue.
    return NextResponse.json(
      {
        error: result.message,
        code: result.code,
        // Signal to the client: don't create a new payment; ask admin.
        manualReview: true,
      },
      { status: 400 }
    );
  }

  // Hard-reject on EasySlip duplicate: the same transfer was already
  // verified against another payment record (often ours, often a customer
  // re-uploading after we approved them). Approving twice would grant
  // double VIP. Mark this payment failed and clear the slip key so the
  // admin queue isn't polluted.
  if (result.data.isDuplicate === true) {
    await db
      .update(payments)
      .set({ status: "failed", slipImageR2Key: null })
      .where(eq(payments.id, paymentId));
    return NextResponse.json(
      {
        error: "สลิปนี้ถูกใช้แล้ว ไม่สามารถใช้ซ้ำได้",
        code: "DUPLICATE_SLIP",
      },
      { status: 409 }
    );
  }

  // Run remaining verification rules (amount / bank / account / date)
  const rule = checkSlipRules(result.data, snapshot, {
    expectedAmount,
    paymentCreatedAt: payment.createdAt,
  });
  if (!rule.ok) {
    return NextResponse.json(
      { error: rule.message, manualReview: true },
      { status: 400 }
    );
  }

  // DB transaction: race-safe completion
  try {
    await db.transaction(async (tx) => {
      // Re-check payment status + expiry under lock
      const [fresh] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);
      if (!fresh) throw new Error("NOT_FOUND");
      if (fresh.status === "completed") throw new Error("ALREADY_COMPLETED");
      if (fresh.status !== "pending") throw new Error("BAD_STATE");
      if (fresh.expiresAt && new Date(fresh.expiresAt) < new Date()) {
        throw new Error("EXPIRED");
      }

      const transRef = result.data.rawSlip.transRef;
      const startDate = new Date();
      const endDate =
        plan.durationDays >= 36500
          ? null
          : new Date(startDate.getTime() + plan.durationDays * 86_400_000);

      // paidAt = "when we received the money" (now), not slipDate which
      // can be older due to timezone or older slip uploads. The slip's
      // own timestamp is preserved on result.data.rawSlip.date if we
      // ever need to audit it; we don't want subscription windows
      // starting in the past.
      await tx
        .update(payments)
        .set({
          status: "completed",
          paidAt: startDate,
          easyslipTransRef: transRef,
        })
        .where(eq(payments.id, paymentId));

      await tx.insert(subscriptions).values({
        id: nanoid(),
        userId: payment.userId,
        pricingPlanId: payment.pricingPlanId,
        status: "active",
        startDate,
        endDate,
        amountPaid: payment.amount,
        paymentRef: transRef,
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "ALREADY_COMPLETED" || message === "BAD_STATE") {
      return NextResponse.json(
        { error: "รายการนี้ดำเนินการไปแล้ว" },
        { status: 409 }
      );
    }
    if (message === "EXPIRED") {
      return NextResponse.json(
        { error: "หมดเวลาชำระเงิน" },
        { status: 410 }
      );
    }
    if (message === "NOT_FOUND") {
      return NextResponse.json(
        { error: "ไม่พบรายการชำระเงิน" },
        { status: 404 }
      );
    }
    if (typeof err === "object" && err && "code" in err && err.code === "23505") {
      return NextResponse.json(
        { error: "สลิปนี้ถูกใช้แล้ว" },
        { status: 409 }
      );
    }
    console.error("[verify-slip] tx failed", err);
    return NextResponse.json(
      { error: "ระบบขัดข้อง กรุณาลองใหม่" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

interface CheckOpts {
  expectedAmount: number;
  paymentCreatedAt: Date | string;
}

function checkSlipRules(
  data: EasySlipSuccessData,
  snapshot: AccountSnapshot,
  opts: CheckOpts
): { ok: true } | { ok: false; message: string } {
  // Rule 2: amount matched (both flag + literal compare).
  // isAmountMatched is optional in the response (only present when matchAmount
  // was sent — which we always do); we still treat its absence as a mismatch
  // for safety.
  if (data.isAmountMatched !== true) {
    return { ok: false, message: "ยอดเงินในสลิปไม่ตรงกับแพ็กเกจ" };
  }
  if (Math.abs(data.rawSlip.amount.amount - opts.expectedAmount) > 0.01) {
    return { ok: false, message: "ยอดเงินในสลิปไม่ตรงกับแพ็กเกจ" };
  }
  // Rule 3a: receiver bank id
  if (data.rawSlip.receiver.bank.id !== snapshot.bankCode) {
    return { ok: false, message: "ธนาคารปลายทางในสลิปไม่ตรงกัน" };
  }
  // Rule 3b: receiver account tail.
  // EasySlip returns either `bank.account` (regular transfer) or `proxy.account`
  // (PromptPay/MSISDN/etc). Snapshot only stores the bank account number, but
  // tail-match works on digits regardless: a PromptPay-by-phone slip will have
  // proxy.account = phone-number, which won't match the bank account tail —
  // that's the correct behavior because we cannot verify the customer hit the
  // right account otherwise.
  const slipAcc =
    data.rawSlip.receiver.account.bank?.account ??
    data.rawSlip.receiver.account.proxy?.account ??
    "";
  if (!slipAcc) {
    return {
      ok: false,
      message: "ไม่สามารถอ่านบัญชีปลายทางในสลิปได้",
    };
  }
  if (!tailMatches(slipAcc, snapshot.accountNumber)) {
    return {
      ok: false,
      message: "บัญชีปลายทางในสลิปไม่ตรงกับบัญชีที่ระบบกำหนด",
    };
  }
  // Rule 4 (duplicate) is handled by the caller as a hard-reject path
  // — we drop it here so this function focuses on data-shape checks.
  // Rule 6: slip date not before payment.createdAt - grace
  const slipDate = new Date(data.rawSlip.date).getTime();
  const earliest =
    new Date(opts.paymentCreatedAt).getTime() - STALE_GRACE_MS;
  if (slipDate < earliest) {
    return {
      ok: false,
      message: "สลิปนี้โอนก่อนสร้างรายการ ไม่สามารถใช้ได้",
    };
  }
  return { ok: true };
}
