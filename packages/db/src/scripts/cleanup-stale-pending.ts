/**
 * One-shot cleanup of stale pending payment records.
 *
 * Targets — payments that we KNOW are dead leads:
 *   1. easyslip pending with NO slip attached and older than 24h
 *   2. anypay pending with expiresAt in the past
 *
 * Does NOT touch:
 *   - easyslip pending with a slip attached (admin still needs to review)
 *   - completed / expired / failed records
 *
 * Run with:
 *   npx tsx packages/db/src/scripts/cleanup-stale-pending.ts
 */
import { config } from "dotenv";
config({ path: "../../.env" });
config({ path: "../../../.env" });
config({ path: ".env" });

async function main() {
  const { db } = await import("../index");
  const { payments } = await import("../schema");
  const { sql, and, eq, lt, isNull } = await import("drizzle-orm");

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  console.log("Cutoff for easyslip-no-slip:", cutoff.toISOString());

  // Easyslip pending, no slip, older than 24h
  const easyslipResult = await db
    .update(payments)
    .set({ status: "expired" })
    .where(
      and(
        eq(payments.status, "pending"),
        eq(payments.provider, "easyslip"),
        isNull(payments.slipImageR2Key),
        lt(payments.createdAt, cutoff)
      )
    )
    .returning({ id: payments.id });
  console.log(
    `Expired ${easyslipResult.length} easyslip pendings without slip > 24h`
  );

  // Anypay pending with elapsed expiresAt
  const anypayResult = await db
    .update(payments)
    .set({ status: "expired" })
    .where(
      and(
        eq(payments.status, "pending"),
        eq(payments.provider, "anypay"),
        lt(payments.expiresAt, new Date())
      )
    )
    .returning({ id: payments.id });
  console.log(`Expired ${anypayResult.length} anypay pendings past expiresAt`);

  // Summary of what's left
  const remaining = await db
    .select({
      status: payments.status,
      provider: payments.provider,
      hasSlip: sql<boolean>`bool_or(${payments.slipImageR2Key} is not null)`,
      c: sql<number>`count(*)::int`,
    })
    .from(payments)
    .where(eq(payments.status, "pending"))
    .groupBy(payments.status, payments.provider);
  console.log("\nRemaining pending payments:");
  console.log(remaining);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
