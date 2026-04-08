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
