# Payment and Telegram recovery (2026-09-16)

Payment review now resumes the original order, retains immutable slip images and
records verification outcome codes in `admin_audit_logs`. The order's stored amount
is authoritative. Expiry limits the transfer date, not the upload date. Transfers
outside the window, ambiguous provider duplicates, proxy accounts and invalid
responses require review; none automatically grant membership.

The verification, creation, approval and rejection routes use a shared per-user
PostgreSQL advisory lock. Completion also locks the bank transaction reference;
existing payment/subscription unique indexes remain the final constraint.
Verification uploads have a bounded body, signature checks, 30-second retry
cooldown, a 20-second storage timeout and a 15-second provider timeout.

## Existing customer tickets

In Payments, search by payment ID or customer. Review the saved slip and bank
receipt, enter the bank transaction reference, then confirm approval. If an admin
already granted membership for this transfer, explicitly link that subscription
instead of granting another. Linking does not extend or revive its dates. The
subscription must belong to this user/plan, be a manual grant, and have been
created after the payment. Closing a support ticket alone does not settle a payment.

Historical rejected records with missing images/references need individual review;
this release does not guess whether money was received or grant them in bulk.
`reverify-pending-slips.ts` is now a read-only pending-review report; `--apply`
is intentionally rejected because its old bulk recovery bypassed duplicate rules.

## Telegram

The service performs serial, periodic catch-up rather than registering listeners
only after a one-time backfill. It caches resolved groups, warms dialog entities
for private IDs, honors account-wide flood waits and retries failed groups with
backoff. Every cycle logs each group's last successful sync and next retry.
Each topic processes at most 100 messages or approximately 60 seconds per pass,
oldest first. Failed messages are retried in a separate bounded queue with a
15-minute cooldown so they do not block new clips. File references are refreshed
before download and once more if Telegram reports an expired reference. A per-group
database lock prevents two new-version workers syncing that group simultaneously.
Telegram access removal, expired sessions, and permanent media failures still need
operator action; logs now expose these instead of silently abandoning a group.

## Verification

Type-check web, backoffice and telegram-sync with their workspace `tsc --noEmit`.
For integration tests, create a disposable local PostgreSQL database in UTC, push
the schema using `pnpm --filter @kodhom/db exec drizzle-kit push --force` with
`DATABASE_URL` pointing to that disposable database, then set `TEST_DATABASE_URL`
to the same database and run `node scripts/payment-regression.cjs`.

The integration test resets that database. It runs real route handlers and real
PostgreSQL transactions, with authentication, R2 and EasySlip replaced by test
fixtures. It covers races, reference reuse, malformed uploads, amount/date rules,
manual reconciliation, outages and multi-page Telegram catch-up. It does not
charge money or submit production slips to EasySlip.

No schema migration is required. Deploy web, backoffice and telegram-sync from
the same revision. Check deployment/build logs and sync heartbeats after rollout.
