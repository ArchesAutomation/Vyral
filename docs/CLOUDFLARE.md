# Cloudflare demo deployment

Live URL: https://vyral.archesautomation.workers.dev/

The Cloudflare version uses the same React studio and domain actions as the local Next.js app. A module Worker serves the compiled client and authenticated API. One SQLite-backed `VyralStudio` Durable Object stores owner sessions, encrypted provider credentials, brands, immutable composition revisions, and jobs. Private R2 bucket `vyral-media` stores media. Durable Object alarms run generation polling and approved sandbox publishing while the browser is closed.

This deployment targets Workers Free without Containers. It is a shared owner workspace for a few trusted testers, not independent user accounts. Password setup requires a random one-time token; only its SHA-256 hash is deployed. The setup URL uses a fragment, removed from the address bar after reading. Passwords use salted PBKDF2; server-side session tokens are random, stored as hashes, HTTP-only, Secure, SameSite strict, and expire after seven days. OpenRouter keys are encrypted with a Worker secret. The R2 bucket has no public download endpoint; asset requests pass through authentication.

## Demo export limits

- Upload and generated-file maximum: 25 MB per file.
- Application media quota: 8 GB (below R2's 10 GB monthly Standard storage free allowance; requests and other usage still have their own allowances).
- Exports: up to 60 seconds, 32 clips, 720 pixels wide, 30 fps target, in real time.
- Export uses Canvas, Web Audio, and MediaRecorder in a foreground browser tab. MP4 is chosen where the browser supports it; otherwise WebM. Codec support and performance vary by device. A hidden tab stops the export with an error; retry with it visible.
- Basic cover crop, timed text, clip timing, source/audio-track volume, contrast/brightness/saturation. Preview/export are browser approximations, not FFmpeg-quality parity. Gamma and advanced transitions are not supported by the demo renderer.
- AI generation requires a user-supplied paid OpenRouter key. No paid provider call was made during deployment. Estimates are not provider-enforced hard cost caps.
- Social providers remain sandbox only. No live Instagram, YouTube, or TikTok OAuth/posting/analytics is supplied by hosting this app.

## Rebuild and deploy

Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run build:cloudflare`. The last command builds `.cloudflare/worker.js` using TypeScript's compiler and a small deterministic module packer. It includes the production React client, CSS, and Worker entry; no Node filesystem or native renderer enters the Worker graph. Generated assets/build output are ignored. The local Next.js + native FFmpeg deployment remains available.

`cloudflare/deployment.json` is Cloudflare multipart upload metadata, not Wrangler configuration. Upload `.cloudflare/worker.js` through the Workers script API as a JavaScript module, with that metadata and secret bindings `ENCRYPTION_KEY` (64 random hex characters) and `SETUP_TOKEN_HASH`. On first creation only, include `migrations: {new_tag: "v1", new_sqlite_classes: ["VyralStudio"]}`. Enable the script's workers.dev subdomain. Subsequent uploads must preserve the encryption secret, bindings, migration history, and production `STUDIO_ID: owner`. Never regenerate the encryption key for an existing studio or provider credentials cannot be decrypted.

The initial deployment was performed through the connected Cloudflare API. All future production changes must follow the GitHub review policy in `AGENTS.md` and `RELEASE_WORKFLOW.md`: PR, Nick's explicit approval, merge, verified CI deployment. Do not repeat manual plugin/API/CLI uploads. The proposed Studio checks workflow includes a main-only deployment job; it becomes active after the setup PR is approved/merged and the `CLOUDFLARE_API_TOKEN` GitHub Actions secret is connected. Never commit tokens or the one-time setup link.

The API metadata enables sampled logs and traces. Avoid logging request bodies, passwords, setup tokens, media contents, or provider keys. Existing unrelated Workers are unchanged.

## Validation boundary

`tests/cloudflare.test.mjs` executes the compiled Worker with SQLite/R2 test adapters and verifies first-use setup, login, CSRF origin checks, private uploads/downloads, immutable export linkage, session persistence across object reconstruction, and alarm-driven sandbox publishing. This is an adapter integration test, not a workerd emulator. The live public setup screen and resource bindings are checked separately. Browser export is verified with a real Chrome encoder against a local fixture; the environment blocks automated Chrome access to the public workers.dev URL. Paid provider integration remains unverified.
