# Tenant streaming memory incident — 2026-09-24

## Evidence

- Host: `168.144.46.120`; affected tenant: `kodhom.com`.
- Before recovery: tenant Node process held 1,220 socket file descriptors and
  approximately 3 GiB of swap. Global TCP memory reached 326,211 pages against
  a 325,000-page maximum; the kernel repeatedly reported `TCP: out of memory`.
- Public page requests stalled or timed out after 15–20 seconds. The main web
  container itself returned pages in approximately 0.10–0.18 seconds.
- Restarting only the tenant released the accumulated resources: TCP memory
  fell to approximately 8 MiB and host swap usage fell from 3.9 GiB to 1 GiB.
  This implicates tenant connection accumulation; the exact original leak
  mechanism was not reproduced under a debugger.

## Changes deployed

- R2 proxy uses a dedicated Undici request agent with at most 64 connections
  per origin, connection/header/body-idle timeouts, and 10-second idle keepalive.
- Proxy response buffering is bounded in bytes; response cancellation destroys
  the upstream stream. All five tenant media routes forward the viewer's abort
  signal. Range and conditional request behavior are preserved.
- Tenant memory capped at 1.5 GiB, with a 2 GiB combined memory/swap cap.
  Limits were saved in Coolify's application settings as well as live Compose.
- Production image: `yedhod-tenant:stream-fix-20260924`.
- Production container: `xbr5s6t89zf1wiwgz7a7c2a5-081713877094`.

The image was built from Git HEAD `d0ab7ef` plus only this fix's files. Existing
unrelated workspace edits were excluded. The source fix and regression tests
are committed together so later source-based Coolify deployments retain the
stream lifecycle changes. The running hotfix image remains independently
available for recovery.

## Validation

- Tenant TypeScript check passed independently of Next's configured type skip.
- Production Docker build passed.
- Four integration tests passed: Range/304, request abort, body cancellation,
  and backpressure against a 256 MiB simulated video.
- Isolated canary served a 65,536-byte `206` video response and a thumbnail.
  After eight interrupted video requests and idle cleanup, it had 11 socket
  descriptors and used approximately 78 MiB RAM. Canary was removed afterward.
- Public production video returned `206`, 65,536 bytes, in 0.18 seconds.
- Early post-deployment check: 12 tenant socket descriptors, no restarts/OOM,
  approximately 8 MiB global TCP memory, and no new TCP memory errors in five
  minutes. Most public page samples completed under two seconds, but one main
  homepage sample took 9.27 seconds; do not treat these samples as an SLA or
  proof that all network latency has been eliminated.
- Follow-up concurrent probes isolated residual stalls to the VPS-to-public-
  Cloudflare path: direct app and loopback HTTPS proxy requests completed in
  0.29–0.89 seconds while some VPS public requests still timed out at 15 seconds.
  No interface drops or conntrack exhaustion were observed; this remaining
  route issue was not conclusively diagnosed. Nine final public probes from the
  user's workstation (three routes, three rounds) all returned 200 and completed
  in 0.40–0.77 seconds. No claim of long-term stability is made from this window.

Run tests locally:

```powershell
pnpm --filter @kodhom/tenant exec tsx --test ../../packages/r2/src/stream-response.test.ts
pnpm --filter @kodhom/tenant exec tsc --noEmit --incremental false
```

## Recovery artifacts (root-only, on server)

- `/root/yedhod-stream-fix-20260924/`: exact build source and build log.
- `/root/yedhod-stream-fix-20260924/docker-compose.before.yaml`: prior Compose.
- `/root/tenant-stream-fix-20260924.tar`: exact source archive.
- Live Compose: `/data/coolify/applications/xbr5s6t89zf1wiwgz7a7c2a5/docker-compose.yaml`.

For rollback, restore the prior image
`xbr5s6t89zf1wiwgz7a7c2a5:d0ab7ef59fea7d7798634d4d0eb111a4245ed329`
in live Compose while retaining the memory limits, then recreate only the tenant
service with its existing project and environment. The prior image is retained.
