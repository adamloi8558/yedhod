-- Audit fixes + EasySlip integration migration
-- Adds: indexes for hot-path queries, EasySlip columns on payments, unique
-- constraints on payment refs to enforce idempotency at the DB layer.

-- ==== payments: add EasySlip columns + ensure provider has a default ====
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "provider" text NOT NULL DEFAULT 'anypay';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "easyslip_trans_ref" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "account_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "slip_image_r2_key" text;--> statement-breakpoint

-- ==== unique partial indexes (idempotency at the DB layer) ====
CREATE UNIQUE INDEX IF NOT EXISTS "payments_anypay_ref_uniq"
  ON "payments" ("anypay_ref")
  WHERE "anypay_ref" IS NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payments_easyslip_trans_ref_uniq"
  ON "payments" ("easyslip_trans_ref")
  WHERE "easyslip_trans_ref" IS NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_payment_ref_uniq"
  ON "subscriptions" ("payment_ref")
  WHERE "payment_ref" IS NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "withdrawals_anypay_ref_uniq"
  ON "withdrawals" ("anypay_ref")
  WHERE "anypay_ref" IS NOT NULL;--> statement-breakpoint

-- ==== hot-path indexes ====
CREATE INDEX IF NOT EXISTS "clips_category_active_created_idx"
  ON "clips" ("category_id", "is_active", "created_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "subscriptions_user_status_idx"
  ON "subscriptions" ("user_id", "status");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sessions_user_expires_idx"
  ON "sessions" ("user_id", "expires_at");
