# @kodhom/tenant

Multi-tenant clone app. Serves multiple ad-driven sites off one Next.js process.
See design spec: `docs/superpowers/specs/2026-07-09-multi-tenant-clone-design.md`.

## Dev

1. Add to `C:\Windows\System32\drivers\etc\hosts`:
   ```
   127.0.0.1  site-a.local
   ```
2. Seed a demo tenant: `pnpm --filter @kodhom/tenant exec tsx scripts/seed-dev-tenant.ts`
3. Start: `pnpm --filter @kodhom/tenant dev`
4. Open `http://site-a.local:3002`

## Prod

- Deploy behind Coolify (Traefik) with multiple domains attached to the same container.
- Each domain maps to a row in `tenants` (managed from `bo.yedhod.com/dashboard/tenants`).
