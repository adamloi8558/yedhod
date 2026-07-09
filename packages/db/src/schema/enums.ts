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
  "sidebar_top",
  "sidebar_mid",
  "sidebar_bot",
  "in_feed_1",
  "in_feed_2",
  "in_feed_3",
  "before_video",
  "after_video",
  "under_title",
  "popunder",
  "footer_top",
  "footer_bottom",
  "sticky_bottom",
]);

export const adTypeEnum = pgEnum("ad_type", [
  "embed",
  "banner",
  "galaksion",
  "aads",
]);
