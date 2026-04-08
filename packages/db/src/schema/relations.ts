import { relations } from "drizzle-orm";
import { users, sessions, accounts } from "./auth";
import { categories } from "./categories";
import { clips } from "./clips";
import { pricingPlans } from "./pricing";
import { subscriptions } from "./subscriptions";
import { payments } from "./payments";
import { withdrawals } from "./withdrawals";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  subscriptions: many(subscriptions),
  payments: many(payments),
  withdrawals: many(withdrawals),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  clips: many(clips),
  pricingPlans: many(pricingPlans),
  subscriptions: many(subscriptions),
}));

export const clipsRelations = relations(clips, ({ one }) => ({
  category: one(categories, {
    fields: [clips.categoryId],
    references: [categories.id],
  }),
  uploader: one(users, {
    fields: [clips.uploadedBy],
    references: [users.id],
  }),
}));

export const pricingPlansRelations = relations(pricingPlans, ({ one, many }) => ({
  category: one(categories, {
    fields: [pricingPlans.categoryId],
    references: [categories.id],
  }),
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [subscriptions.categoryId],
    references: [categories.id],
  }),
  pricingPlan: one(pricingPlans, {
    fields: [subscriptions.pricingPlanId],
    references: [pricingPlans.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  pricingPlan: one(pricingPlans, {
    fields: [payments.pricingPlanId],
    references: [pricingPlans.id],
  }),
  category: one(categories, {
    fields: [payments.categoryId],
    references: [categories.id],
  }),
}));

export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
  requestedByUser: one(users, {
    fields: [withdrawals.requestedBy],
    references: [users.id],
  }),
}));
