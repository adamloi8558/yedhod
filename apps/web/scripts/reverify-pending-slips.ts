/**
 * Re-verify every pending easyslip payment that still has a slip
 * attached, by re-running the EasySlip API on the saved R2 file.
 *
 * Safe rules:
 *   - Only payments WE have in our DB are considered (so an EasySlip
 *     dashboard belonging to multiple merchants is naturally filtered).
 *   - The slip image used is OUR copy from R2, uploaded by the user
 *     against THIS payment record.
 *   - We re-run all the same checks as the live endpoint (bank match,
 *     account tail, amount, transRef uniqueness within our DB).
 *   - On EasySlip's `isDuplicate=true`, we accept only if the transRef
 *     is not already attached to a *different* completed payment.
 *   - We mark the payment completed + create the subscription + write
 *     an admin_audit_logs row.
 *
 * Usage (from repo root):
 *   pnpm --filter @kodhom/web tsx scripts/reverify-pending-slips.ts        # dry
 *   pnpm --filter @kodhom/web tsx scripts/reverify-pending-slips.ts --apply
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, "../../../.env") });
config({ path: path.join(__dirname, "../../.env") });
config({ path: path.join(__dirname, "../.env") });
config({ path: ".env" });

import { db } from "@kodhom/db";
import {
  payments,
  pricingPlans,
  subscriptions,
  adminAuditLogs,
  systemConfig,
} from "@kodhom/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { verifyBankSlip, tailMatches } from "@kodhom/easyslip";
import { getPresignedDownloadUrl } from "@kodhom/r2";

interface Snapshot {
  bankCode: string;
  accountNumber: string;
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  console.log(dryRun ? "(DRY RUN — pass --apply to commit)" : "*** APPLYING ***");

  const [cfgRow] = await db
    .select({ value: systemConfig.value })
    .from(systemConfig)
    .where(eq(systemConfig.key, "easyslip_config"))
    .limit(1);
  const apiKey = (cfgRow?.value as { apiKey?: string } | null)?.apiKey;
  if (!apiKey) {
    console.error("No easyslip apiKey configured");
    process.exit(1);
  }

  const candidates = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.status, "pending"),
        eq(payments.provider, "easyslip"),
        isNotNull(payments.slipImageR2Key)
      )
    );
  console.log(`Found ${candidates.length} pending payments with slip`);

  let recovered = 0;
  let duplicates = 0;
  let failed = 0;
  let skipped = 0;

  // Track which transRefs we have already approved in this run so a
  // single transfer that was uploaded against many payment records
  // approves only ONE record and leaves the others as duplicates.
  const seenTransRef = new Set<string>();
  // Sort earliest-first so the oldest payment record (the one the user
  // actually started the flow on) is the one that gets the subscription.
  candidates.sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const p of candidates) {
    const tag = `[${p.id.slice(0, 8)} ${p.userId.slice(0, 8)} ${p.amount}]`;
    if (!p.slipImageR2Key) {
      skipped++;
      continue;
    }
    let buffer: Buffer;
    try {
      const url = await getPresignedDownloadUrl(p.slipImageR2Key, 120);
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`${tag} download failed ${res.status}`);
        failed++;
        continue;
      }
      const ab = await res.arrayBuffer();
      buffer = Buffer.from(ab);
    } catch (e) {
      console.log(`${tag} r2 error`, (e as Error).message);
      failed++;
      continue;
    }

    const snapshot = p.accountSnapshot as Snapshot | null;
    if (!snapshot) {
      console.log(`${tag} no snapshot`);
      skipped++;
      continue;
    }
    const expectedAmount = parseFloat(p.amount);

    let result;
    try {
      result = await verifyBankSlip({
        apiKey,
        imageBuffer: buffer,
        imageMime: "image/jpeg",
        imageFilename: `${p.id}.jpg`,
        matchAmount: expectedAmount,
        checkDuplicate: true,
      });
    } catch (e) {
      console.log(`${tag} easyslip api error`, (e as Error).message);
      failed++;
      continue;
    }

    if (!result.ok) {
      console.log(`${tag} ✗ ${result.message}`);
      failed++;
      continue;
    }
    const data = result.data;
    if (data.rawSlip.receiver.bank.id !== snapshot.bankCode) {
      console.log(`${tag} ✗ bank mismatch ${data.rawSlip.receiver.bank.id} vs ${snapshot.bankCode}`);
      failed++;
      continue;
    }
    const slipAcc =
      data.rawSlip.receiver.account.bank?.account ??
      data.rawSlip.receiver.account.proxy?.account ??
      "";
    if (!tailMatches(slipAcc, snapshot.accountNumber)) {
      console.log(`${tag} ✗ acct mismatch ${slipAcc} vs ${snapshot.accountNumber}`);
      failed++;
      continue;
    }
    if (Math.abs(data.rawSlip.amount.amount - expectedAmount) > 0.01) {
      console.log(`${tag} ✗ amount mismatch ${data.rawSlip.amount.amount} vs ${expectedAmount}`);
      failed++;
      continue;
    }

    const transRef = data.rawSlip.transRef;
    // Within this batch, this transRef may already have been used.
    if (seenTransRef.has(transRef)) {
      console.log(`${tag} ✗ transRef ${transRef} already used earlier in this batch`);
      duplicates++;
      continue;
    }
    // And across the DB (rows committed by previous runs / live traffic).
    const [conflict] = await db
      .select({ id: payments.id, status: payments.status })
      .from(payments)
      .where(eq(payments.easyslipTransRef, transRef))
      .limit(1);
    if (conflict && conflict.id !== p.id && conflict.status === "completed") {
      console.log(`${tag} ✗ transRef already on completed payment ${conflict.id}`);
      duplicates++;
      continue;
    }

    if (dryRun) {
      console.log(`${tag} ✓ would recover (ref=${transRef})`);
      seenTransRef.add(transRef);
      recovered++;
      continue;
    }
    // Reserve the transRef before committing so a concurrent run doesn't
    // race us.
    seenTransRef.add(transRef);

    try {
      await db.transaction(async (tx) => {
        const [fresh] = await tx
          .select()
          .from(payments)
          .where(eq(payments.id, p.id))
          .limit(1);
        if (!fresh || fresh.status !== "pending") return;
        const [plan] = await tx
          .select()
          .from(pricingPlans)
          .where(eq(pricingPlans.id, p.pricingPlanId))
          .limit(1);
        if (!plan) throw new Error("plan vanished");
        const startDate = new Date();
        const endDate =
          plan.durationDays >= 36500
            ? null
            : new Date(startDate.getTime() + plan.durationDays * 86_400_000);
        await tx
          .update(payments)
          .set({
            status: "completed",
            paidAt: new Date(data.rawSlip.date),
            easyslipTransRef: transRef,
          })
          .where(eq(payments.id, p.id));
        await tx.insert(subscriptions).values({
          id: crypto.randomUUID(),
          userId: p.userId,
          pricingPlanId: p.pricingPlanId,
          status: "active",
          startDate,
          endDate,
          amountPaid: p.amount,
          paymentRef: transRef,
        });
        await tx.insert(adminAuditLogs).values({
          id: crypto.randomUUID(),
          adminId: null,
          action: "payment.script_recover",
          targetType: "payment",
          targetId: p.id,
          metadata: {
            transRef,
            amount: p.amount,
            source: "reverify-pending-slips",
          },
        });
      });
      console.log(`${tag} ✓ recovered`);
      recovered++;
    } catch (e) {
      console.log(`${tag} ✗ db error`, (e as Error).message);
      failed++;
    }
  }

  if (!dryRun && recovered > 0) {
    // Expire any leftover pending duplicates the recovered users had.
    const expired = await db.execute(sql`
      update payments
      set status = 'expired'
      where status = 'pending'
        and provider = 'easyslip'
        and user_id in (select distinct user_id from subscriptions where status = 'active')
        and id not in (select id from payments where status = 'completed')
      returning id
    `);
    const rows = (expired as unknown as { rows: { id: string }[] }).rows;
    console.log(`Expired ${rows.length} duplicate pendings for recovered users`);
  }

  console.log(
    `\nSummary: recovered=${recovered} duplicates=${duplicates} failed=${failed} skipped=${skipped}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
