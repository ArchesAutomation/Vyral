# Architecture

The initial repository contained only a README. Vyral uses Next.js/React/TypeScript for the interface and short authenticated requests. Native SQLite WAL stores records, immutable composition revisions, credentials, sessions, and durable job state. A separate Node worker performs FFmpeg encoding, paid generation requests, video polling, and sandbox publishing. Web and worker share one disk volume; neither requires a browser to remain open.

The master brief prefers PostgreSQL/Supabase, Redis/BullMQ, and independently hosted workers. This first runnable personal slice deliberately avoids provisioning unrelated cloud resources or requiring credentials before it can be explored. This is **not** equivalent to that production multi-tenant architecture. Migrate persistence, identity, and object storage before hosting unrelated customers.

## Boundaries

- `components/`: interactive studio, editor, dialogs, model controls.
- `app/api/`: authenticated API, bounded uploads, authenticated range media delivery.
- `lib/domain.ts`: composition/variant validation, factorial designs, statistics, manual DNA.
- `lib/services.ts`: brand scope, workflow actions, cost reservations, approval gates.
- `lib/db.ts`: SQLite persistence, revisions, transactional queue writes, audit records.
- `lib/security.ts`: owner password, random server-stored session, AES-256-GCM keys.
- `workers/`: queue claims, generation adapters, sandbox publishing, native rendering.
- `vendor/`: pinned MIT components with original license notices.

One worker claims jobs inside `BEGIN IMMEDIATE`. Work has a six-minute lease. Interrupted paid submissions without a known provider ID fail for review instead of being blindly charged again. Known video polling URLs resume. Render failures can be retried explicitly. Scheduling uses UTC timestamps; UI entry uses the browser’s local time. Worker liveness is displayed in the sidebar.

## Security scope

This is one owner with multiple brands, not multiple independent tenants. Every mutation verifies the selected brand and cross-record brand scope. Authentication protects assets and actions. Session cookies are HTTP-only, SameSite strict, and secure over HTTPS. Mutations reject cross-origin browser requests using the actual Host header. Request bodies are bounded even without Content-Length. Uploads use UUID names, media type allowlists, and magic checks. FFmpeg subprocesses use argv without a shell and restrict input protocols. Bookmarked external URLs are never server-fetched. Provider polling is restricted to OpenRouter; credentials never go to unknown download hosts.

Outstanding hardening: team roles/RLS, account-level permissions, password rotation/session revocation UI, distributed login rate limiting, per-owner media quotas, file malware scanning, CSP, backup automation, and a production secret manager. Do not expose this version as a public multi-user SaaS.

## Cloudflare adapter

The hosted demo compiles the existing React studio without Next.js server runtime. `cloudflare/server.ts` routes APIs to one SQLite Durable Object and serves bundled client assets. Build aliases map the synchronous domain service to Cloudflare SQL and secret adapters. AsyncLocalStorage scopes each request/alarm to its own environment. Durable alarms replace the polling Node worker for AI and sandbox tasks. Media lives in private R2 with an 8 GB application quota. Browser export replaces native FFmpeg only for the Cloudflare deployment. See `CLOUDFLARE.md` for boundaries and configuration. This remains a shared owner workspace, not tenant isolation.
