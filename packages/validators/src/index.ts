import { z } from "zod";

// Auth
export const loginSchema = z.object({
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(6, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"),
});

export const registerSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อ"),
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(6, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"),
});

// Categories
export const categorySchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อหมวดหมู่"),
  slug: z
    .string()
    .min(1),
  description: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  accessLevel: z.enum(["member", "vip"]).default("member"),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// Clips
export const clipSchema = z.object({
  title: z.string().min(1, "กรุณากรอกชื่อคลิป"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  accessLevel: z.enum(["member", "vip"]).default("member"),
  r2Key: z.string().min(1),
  thumbnailR2Key: z.string().optional(),
  duration: z.number().optional(),
  fileSize: z.number().int().optional(),
  mimeType: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

// Pricing Plans (global — no categoryId)
export const pricingPlanSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อแพ็กเกจ"),
  slug: z.string().min(1),
  durationDays: z.number().int().positive(),
  priceThb: z.string().regex(/^\d+(\.\d{1,2})?$/, "ราคาไม่ถูกต้อง"),
  maxDevices: z.number().int().positive().default(1),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

// Payment (global — no categoryId)
export const createPaymentSchema = z.object({
  pricingPlanId: z.string().min(1),
  bankNumber: z.string().regex(/^\d+$/, "เลขบัญชีต้องเป็นตัวเลขเท่านั้น"),
});

// System Config
export const systemConfigSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
  description: z.string().optional(),
});

// Banners
export const bannerSchema = z.object({
  id: z.string().min(1),
  imageR2Key: z.string().min(1, "กรุณาอัปโหลดรูป"),
  linkUrl: z
    .string()
    .url("ลิงก์ไม่ถูกต้อง")
    .refine(
      (v) => /^https?:\/\//i.test(v),
      "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://"
    ),
  alt: z.string().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const bannersListSchema = z.array(bannerSchema);

// Payment provider mode + EasySlip config
export const paymentModeSchema = z.object({
  provider: z.enum(["anypay", "easyslip"]),
});

export const easyslipConfigSchema = z.object({
  apiKey: z.string().min(1, "กรุณาระบุ API Key"),
});

export const paymentAccountSchema = z.object({
  id: z.string().min(1),
  bankCode: z.string().regex(/^\d{3}$/, "รหัสธนาคารต้องเป็นเลข 3 หลัก"),
  bankName: z.string().min(1, "กรุณากรอกชื่อธนาคาร"),
  accountNumber: z
    .string()
    .regex(/^\d{8,15}$/, "เลขบัญชีต้องเป็นตัวเลข 8-15 หลัก"),
  accountName: z.string().min(1, "กรุณากรอกชื่อบัญชี"),
  weight: z.number().int().min(0).max(100),
  isActive: z.boolean(),
});

export const paymentAccountsListSchema = z
  .array(paymentAccountSchema)
  .refine(
    (arr) =>
      arr.filter((a) => a.isActive).reduce((sum, a) => sum + a.weight, 0) ===
      100,
    { message: "น้ำหนักรวมของบัญชีที่ใช้งานต้องเท่ากับ 100" }
  );

// EasySlip verify slip
export const verifySlipBodySchema = z.object({
  paymentId: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type ClipInput = z.infer<typeof clipSchema>;
export type PricingPlanInput = z.infer<typeof pricingPlanSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type SystemConfigInput = z.infer<typeof systemConfigSchema>;
export type Banner = z.infer<typeof bannerSchema>;
export type PaymentMode = z.infer<typeof paymentModeSchema>;
export type EasySlipConfig = z.infer<typeof easyslipConfigSchema>;
export type PaymentAccount = z.infer<typeof paymentAccountSchema>;
