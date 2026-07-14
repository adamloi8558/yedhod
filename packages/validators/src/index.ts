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
  parentId: z.string().nullable().optional(),
  isPinned: z.boolean().default(false),
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
  isFeatured: z.boolean().default(false),
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

// Tenants
const hostnameRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export const tenantCreateSchema = z.object({
  slug: z
    .string()
    .min(1, "กรุณากรอก slug")
    .regex(/^[a-z0-9-]+$/, "slug ใช้ได้เฉพาะ a-z, 0-9, -"),
  name: z.string().min(1, "กรุณากรอกชื่อเว็บ"),
  primaryDomain: z
    .string()
    .min(1, "กรุณากรอกโดเมน")
    .transform((v) => v.toLowerCase().trim())
    .refine((v) => hostnameRegex.test(v) || /\.local$/.test(v), {
      message: "โดเมนไม่ถูกต้อง",
    }),
  logoR2Key: z.string().nullable().optional(),
  faviconR2Key: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
  footerText: z.string().nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "สีต้องเป็น hex #RRGGBB")
    .default("#3b82f6"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#60a5fa"),
  backgroundColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#0b0d13"),
  fgColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#e6e9f2"),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  // GA4 measurement id. Empty string coerces to null so the form can
  // clear the value without a special "unset" path.
  googleAnalyticsId: z
    .string()
    .transform((v) => v.trim())
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine(
      (v) => v === null || /^G-[A-Z0-9]{6,}$/.test(v),
      "GA4 ID ต้องขึ้นต้นด้วย G- และเป็นตัวอักษรภาษาอังกฤษพิมพ์ใหญ่/ตัวเลข"
    )
    .optional(),
  // Verification meta tags rendered into <head> of the tenant site.
  // The name/content restrictions block angle-brackets and quotes so a
  // hand-edited row can't break out of the attribute or inject <script>.
  verificationMetas: z
    .array(
      z.object({
        name: z
          .string()
          .trim()
          .min(1, "ต้องกรอกชื่อ meta")
          .max(120)
          .regex(
            /^[a-zA-Z0-9._:-]+$/,
            "ชื่อ meta ใช้ได้เฉพาะตัวอักษร ตัวเลข . _ : -"
          ),
        content: z
          .string()
          .trim()
          .min(1, "ต้องกรอก content")
          .max(500)
          .refine(
            (v) => !/["'<>]/.test(v),
            "content ห้ามมี < > \" '"
          ),
      })
    )
    .max(20, "ใส่ verification ได้สูงสุด 20 รายการ")
    .optional(),
  isActive: z.boolean().default(true),
});

export const tenantUpdateSchema = tenantCreateSchema.partial();

export const tenantCategoriesSchema = z.object({
  items: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        sortOrder: z.number().int().default(0),
      })
    )
    .default([]),
});

const AD_SLOTS = [
  "header_top",
  "header_bottom",
  "catbar_below",
  "hero_below",
  "sidebar_top",
  "sidebar_mid",
  "sidebar_bot",
  "in_feed_1",
  "in_feed_2",
  "in_feed_3",
  "native_row",
  "between_sections",
  "before_video",
  "after_video",
  "under_title",
  "related_below",
  "popunder",
  "footer_top",
  "above_footer",
  "footer_bottom",
  "sticky_bottom",
] as const;

export const tenantAdCreateSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("embed"),
    slot: z.enum(AD_SLOTS),
    embedCode: z.string().min(1, "กรุณาใส่โค้ดโฆษณา"),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("banner"),
    slot: z.enum(AD_SLOTS),
    imageR2Key: z.string().min(1, "กรุณาอัปโหลดรูป"),
    linkUrl: z.string().url("ลิงก์ไม่ถูกต้อง").nullable().optional(),
    altText: z.string().nullable().optional(),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("galaksion"),
    slot: z.enum(AD_SLOTS),
    networkZoneId: z.string().min(1, "กรุณาใส่ zone id"),
    networkWidth: z.number().int().positive().nullable().optional(),
    networkHeight: z.number().int().positive().nullable().optional(),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("aads"),
    slot: z.enum(AD_SLOTS),
    networkZoneId: z.string().min(1, "กรุณาใส่ unit id"),
    networkWidth: z.number().int().positive().default(468),
    networkHeight: z.number().int().positive().default(60),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  }),
]);

export const tenantAdUpdateSchema = z.object({
  slot: z.enum(AD_SLOTS).optional(),
  embedCode: z.string().nullable().optional(),
  imageR2Key: z.string().nullable().optional(),
  linkUrl: z.string().url().nullable().optional(),
  altText: z.string().nullable().optional(),
  networkZoneId: z.string().nullable().optional(),
  networkWidth: z.number().int().positive().nullable().optional(),
  networkHeight: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type TenantCreateInput = z.infer<typeof tenantCreateSchema>;
export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>;
export type TenantCategoriesInput = z.infer<typeof tenantCategoriesSchema>;
export type TenantAdCreateInput = z.infer<typeof tenantAdCreateSchema>;
export type TenantAdUpdateInput = z.infer<typeof tenantAdUpdateSchema>;

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
