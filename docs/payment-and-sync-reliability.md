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

Forum passes now also yield between topics after approximately 60 seconds and
resume at the next topic, allowing other sources to run. Explicitly requested
backfill records run before ordinary discovery and retain their priority after
transient failures. While eligible recovery work exists on enabled, available
sources, passes focus on that work; older unrelated history resumes afterward.
Removed sources and groups waiting on error backoff cannot hold that mode open.
Discovery positions are stored separately in the internal
`telegram_sync_cursors` config value, so an out-of-order replay cannot skip unseen
history. This internal value is excluded from the editable settings API. Source
configuration is refreshed between cycles and checked before processing a group.

Large videos download to temporary files and stream to R2 with a ten-minute upload
deadline. The worker verifies the downloaded byte count, logs download progress
every 30 seconds, and removes temporary data on success or handled failure. A live
32 KiB R2 stream upload/readback passed with matching SHA-256; regression coverage
also checks truncated downloads and storage failures. The current integration
suite has 27 cases, including replay cursor safety and fair forum scheduling.

To audit missing videos from a specific source date (including that date), run
`pnpm --filter @kodhom/telegram-sync exec tsx src/scripts/backfill-since.ts --since=2026-09-08T00:00:00+07:00`
in the service environment. The default only compares Telegram metadata with the
sync ledger. Add `--apply` to queue missing records for the existing worker's retry
loop. Existing records are never overwritten, including during concurrent sync.
The report's `queued` count means scheduled, not downloaded; check `synced` on a
subsequent audit to verify completion. `unrouted` videos and group errors need review.

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

## Deployment host recovery, 2026-09-16

The host's TCP page allocation exceeded its boot-time `tcp_mem` maximum
(`189505` allocated versus `187308` maximum). Connections advertised tiny receive
windows, while CPU, disk and memory pressure measurements were normal. Downloading
the same npm tarball improved from approximately 14 KB/s to 33 MB/s in a temporary
TCP-limit test, and 48 MB/s after applying the setting.

The host now uses `/etc/sysctl.d/90-yedhod-tcp-memory.conf` with
`net.ipv4.tcp_mem = 225000 275000 325000` (4 KiB pages; maximum about 1.24 GiB).
The previous value is saved at
`/root/yedhod-recovery-20260916/tcp_mem.original`. This host setting is independent
of Docker images. Monitor TCP page allocation and available RAM if throughput
degrades again; raising limits indefinitely is not a recovery strategy.

Source reconciliation retained the protected group `-1003892087188`. One invalid
username and five sources with no messages on repeated checks were removed from
`telegram_group_id`, leaving 16 sources. Each remaining source passed a 4 KiB media
read probe; that is an access check, not a full-video integrity test. An inclusive
audit from September 8, Bangkok time, found 375 videos, of which two were already
synced and 373 were queued. A second apply queued zero additional records.

After the TCP repair, web and backoffice deployed successfully from `91e527f`.
Both login pages and the web session endpoint returned HTTP 200; the protected
backoffice dashboard redirected unauthenticated requests with HTTP 307. The sync
worker was restarted with the 16-source configuration and resumed successful
imports. Backfill downloads were still running at handoff; the queue audit is not
a claim that every video has finished importing.
