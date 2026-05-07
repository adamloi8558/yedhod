import type { EasySlipErrorCode } from "./types";

export const easyslipErrorMessages: Record<EasySlipErrorCode, string> = {
  MISSING_API_KEY: "ระบบยังไม่ได้ตั้งค่า API Key (กรุณาติดต่อแอดมิน)",
  INVALID_API_KEY: "API Key ไม่ถูกต้อง (กรุณาติดต่อแอดมิน)",
  IP_NOT_ALLOWED: "IP ของเซิร์ฟเวอร์ไม่ได้รับอนุญาต (กรุณาติดต่อแอดมิน)",
  BRANCH_INACTIVE: "บริการตรวจสลิปถูกระงับชั่วคราว",
  SERVICE_BANNED: "บริการตรวจสลิปถูกระงับ",
  USER_BANNED: "บัญชีผู้ใช้ตรวจสลิปถูกระงับ",
  QUOTA_EXCEEDED: "โควต้าตรวจสลิปหมด กรุณาลองใหม่ภายหลังหรือติดต่อแอดมิน",
  VALIDATION_ERROR: "ไฟล์สลิปไม่ถูกต้อง",
  SLIP_NOT_FOUND: "ไม่พบข้อมูลสลิป กรุณาตรวจสอบรูปอีกครั้ง",
  API_SERVER_ERROR: "ระบบตรวจสลิปขัดข้อง กรุณาลองใหม่",
  NETWORK: "ไม่สามารถเชื่อมต่อระบบตรวจสลิปได้ กรุณาลองใหม่",
  TIMEOUT: "ระบบตรวจสลิปตอบช้าเกินไป กรุณาลองใหม่",
  UNKNOWN: "ไม่สามารถตรวจสอบสลิปได้ กรุณาลองใหม่",
};

const knownCodes = new Set(Object.keys(easyslipErrorMessages));

export function mapEasySlipError(code: string | undefined): {
  code: EasySlipErrorCode;
  message: string;
} {
  const normalized: EasySlipErrorCode =
    code && knownCodes.has(code) ? (code as EasySlipErrorCode) : "UNKNOWN";
  return { code: normalized, message: easyslipErrorMessages[normalized] };
}
