import { tailMatches } from "./match";
import type { EasySlipSuccessData } from "./types";

export function slipRuleError(data: EasySlipSuccessData, expected: {
  amount: string; bankCode: string; accountNumber: string;
  createdAt: Date | string; expiresAt: Date | string | null; now?: number;
}): string | null {
  const raw = data?.rawSlip;
  const amount = Number(expected.amount);
  if (!raw || !Number.isFinite(raw.amount?.amount) || !Number.isFinite(amount) || amount <= 0 ||
      typeof raw.transRef !== "string" || !raw.transRef.trim() || raw.transRef.length > 200 || typeof data.isDuplicate !== "boolean") {
    return "INVALID_RESPONSE";
  }
  // The provider match flag is optional. Compare the actual amount in satang.
  if (data.isAmountMatched === false || Math.round(raw.amount.amount * 100) !== Math.round(amount * 100)) return "AMOUNT_MISMATCH";
  if (raw.receiver?.bank?.id !== expected.bankCode) return "BANK_MISMATCH";
  // A phone/ID proxy is not a bank account. Never compare its suffix to one.
  const receiver = raw.receiver?.account?.bank;
  if (!receiver || receiver.type !== "BANKAC" || typeof receiver.account !== "string" || !tailMatches(receiver.account, expected.accountNumber)) return "ACCOUNT_MISMATCH";
  const date = Date.parse(raw.date);
  const created = new Date(expected.createdAt).getTime();
  const expires = expected.expiresAt ? new Date(expected.expiresAt).getTime() : Infinity;
  if (!Number.isFinite(date) || !Number.isFinite(created) || Number.isNaN(expires)) return "INVALID_DATE";
  if (date < created - 5 * 60_000) return "SLIP_TOO_OLD";
  if (date > (expected.now ?? Date.now()) + 60_000) return "FUTURE_SLIP";
  // Expiry applies to the transfer time, not when the customer uploads it.
  if (date > expires) return "TRANSFER_AFTER_EXPIRY";
  return null;
}

export const slipRuleMessages: Record<string, string> = {
  INVALID_RESPONSE: "ข้อมูลตรวจสลิปไม่ครบ กรุณารอแอดมินตรวจสอบ",
  AMOUNT_MISMATCH: "ยอดเงินในสลิปไม่ตรงกับรายการ กรุณาติดต่อแอดมิน ไม่ต้องโอนซ้ำ",
  BANK_MISMATCH: "ธนาคารปลายทางไม่ตรงกับรายการ กรุณาติดต่อแอดมิน",
  ACCOUNT_MISMATCH: "ยังยืนยันบัญชีปลายทางไม่ได้ กรุณารอแอดมินตรวจสอบ ไม่ต้องโอนซ้ำ",
  INVALID_DATE: "อ่านวันเวลาโอนไม่ได้ กรุณารอแอดมินตรวจสอบ",
  SLIP_TOO_OLD: "สลิปโอนก่อนสร้างรายการ กรุณาแจ้งแอดมินเพื่อตรวจรายการเดิม",
  FUTURE_SLIP: "วันเวลาในสลิปไม่ถูกต้อง กรุณารอแอดมินตรวจสอบ",
  TRANSFER_AFTER_EXPIRY: "โอนหลังเวลาที่กำหนด กรุณารอแอดมินตรวจสอบ ไม่ต้องโอนซ้ำ",
};
