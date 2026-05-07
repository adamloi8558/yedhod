import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import type { PaymentAccount, PaymentMode, EasySlipConfig } from "@kodhom/validators";

export type PaymentProvider = "anypay" | "easyslip";

const KEY_MODE = "payment_mode";
const KEY_EASYSLIP = "easyslip_config";
const KEY_ACCOUNTS = "payment_accounts";

async function readKey<T>(key: string): Promise<T | null> {
  const [row] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, key))
    .limit(1);
  return (row?.value as T) ?? null;
}

export async function getPaymentMode(): Promise<PaymentProvider> {
  const v = await readKey<PaymentMode>(KEY_MODE);
  return v?.provider === "easyslip" ? "easyslip" : "anypay";
}

export async function getEasySlipConfig(): Promise<EasySlipConfig | null> {
  return readKey<EasySlipConfig>(KEY_EASYSLIP);
}

export async function getPaymentAccounts(): Promise<PaymentAccount[]> {
  const v = await readKey<PaymentAccount[]>(KEY_ACCOUNTS);
  return Array.isArray(v) ? v : [];
}

/**
 * Pick a payment account using weighted random selection.
 * Throws if no active accounts exist or weights don't sum to 100.
 */
export function pickWeightedAccount(
  accounts: PaymentAccount[]
): PaymentAccount {
  const active = accounts.filter((a) => a.isActive);
  if (active.length === 0) {
    throw new Error("ไม่มีบัญชีรับเงินที่ใช้งานในระบบ");
  }
  const total = active.reduce((s, a) => s + a.weight, 0);
  if (total !== 100) {
    throw new Error("น้ำหนักรวมของบัญชีต้องเท่ากับ 100");
  }
  const pick = Math.random() * 100;
  let cumulative = 0;
  for (const a of active) {
    cumulative += a.weight;
    if (pick < cumulative) return a;
  }
  return active[active.length - 1];
}
