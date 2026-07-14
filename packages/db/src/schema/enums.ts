import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["member", "vip", "admin"]);
export const accessLevelEnum = pgEnum("access_level", ["member", "vip"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "expired",
  "cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "completed",
  "expired",
  "failed",
]);

export const adSlotEnum = pgEnum("ad_slot", [
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
]);

export const adTypeEnum = pgEnum("ad_type", [
  "embed",
  "banner",
  "galaksion",
  "aads",
]);
