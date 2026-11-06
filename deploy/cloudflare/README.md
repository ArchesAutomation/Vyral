# Cloudflare demo deployment

Live site: https://vyral.archesautomation.workers.dev/

This directory preserves the exact compiled Worker deployed on November 6, 2026. It contains the React studio, Cloudflare API adapter, SQLite Durable Object, private R2 media adapter, foreground browser renderer, and durable job alarms. The local Next.js and native FFmpeg implementation remains in the rest of this repository.

## Demo scope

- Shared password-protected owner workspace for a few trusted testers; separate team accounts and tenant isolation are not implemented.
- Projects, brands, revisions, provider credentials and sessions persist in one SQLite-backed VyralStudio Durable Object.
- Media uses private R2 bucket vyral-media. Its public r2.dev endpoint is disabled. Downloads require the studio session.
- Upload/output limit 25 MB; application media storage quota 8 GB.
- Browser exports support up to 60 seconds, 32 clips and 720 pixels wide. Keep the exporting tab visible. MP4 or WebM depends on browser support. Native FFmpeg remains available in the local deployment.
- AI generation requires the user's paid OpenRouter key; no paid generation was tested. Social publishing remains sandbox only.
- No Workers Paid upgrade or rendering Containers were enabled.

## Deployment

worker.js is an ES module artifact. Upload through Cloudflare Workers Script API as a multipart JavaScript module with metadata.json as the metadata part. Preserve the production STUDIO_ID owner value and existing Durable Object migration history. The first deployment used migration tag v1 with new_sqlite_classes: [VyralStudio]; do not repeat that migration on an existing deployment.

Two secret bindings must exist and must not be committed: ENCRYPTION_KEY (64 random hex characters; preserve it across deployments) and SETUP_TOKEN_HASH (SHA-256 of a cryptographically random one-time setup token). The initial setup screen lets the owner choose a password of at least 16 characters. Never publish the setup token in repository content.

The interface uses salted PBKDF2 passwords, hashed random session tokens, Secure/HttpOnly/SameSite cookies, origin checks, bounded bodies, file signature checks, encrypted provider keys, and private authenticated media delivery. This is a trusted owner demo, not a public multi-tenant SaaS.

GitHub push-to-deploy is not configured. Deployments in this session used the connected Cloudflare API. The editable adapter source is synchronized in cloudflare/, lib/browser-render.ts, and the shared React components. Run npm run build:cloudflare to rebuild from source; see docs/CLOUDFLARE.md. This directory retains the exact initial deployed artifact as a deployment checkpoint.

## Verification performed

- All 20 local automated checks passed, including the original native FFmpeg test and a compiled Cloudflare adapter integration test.
- Next.js production build and TypeScript check passed.
- Real Chrome browser journey against a loopback SQLite/R2 fixture passed: first-use setup, brand creation, upload, editor autosave, browser export, authenticated full/range downloads, variations, scheduled sandbox approval/alarm, session persistence and desktop/mobile layout.
- FFprobe verified an actual browser-exported H.264 file at 720x1280 and 1.99 seconds for a two-second composition.
- Public Cloudflare page and test-workspace sign-in were checked in the connected browser. Full live media/provider verification was not completed.
- Production owner workspace was activated separately from QA; its password has not been set by the agent.
