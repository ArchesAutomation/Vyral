# Vyral

A private, brand-agnostic creative studio: inspiration → original project → editable composition → A–Z variants → MP4 render → approved sandbox publishing → measured comparison → next experiment.

Next.js 16, React 19, TypeScript, native Node SQLite, a separate durable worker, and native FFmpeg. Dark charcoal workspace with warm orange accents. No external credentials are needed for editing, experiments, or sandbox publishing.

## Run locally

Use **Node 24 LTS**, npm, FFmpeg and FFprobe (with drawtext support and an installed font).

```sh
npm ci
cp .env.example .env.local
```

Set `STUDIO_PASSWORD` (16+ characters), `SESSION_SECRET` (32+ characters), and `ENCRYPTION_KEY` (64 hex characters). Generate a key with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run in two terminals:

```sh
npm run dev
npm run worker
```

Open **http://127.0.0.1:3000**, sign in, and create your first brand. On Windows, set absolute `FFMPEG_PATH` and `FFPROBE_PATH` in `.env.local` if the binaries are not on PATH. A render failure includes the encoder error in Settings → Background jobs.

Docker alternative (after configuring `.env.local`):

```sh
docker compose up --build
```

Docker binds the app to localhost. Both services share the same persistent volume. Use one worker. Docker execution has not been verified in the build environment.

## What works

- Password-protected owner studio with encrypted OpenRouter key storage.
- Multiple brand profiles, audience/voice/claim guidelines, and brand-scoped records.
- Inspiration bookmarks and explicitly notes-based Creative DNA; adaptation into original briefs.
- Persistent uploads and an asset library; generation and render provenance.
- Open Higgsfield model catalog and payload builders reused under MIT.
- Text/image-to-image and text/image-to-video request paths, asynchronous video polling, durable job history, and estimated daily budget reservations. Live generation awaits a user key and provider verification.
- AI script/storyboard generation using an explicitly chosen OpenRouter model.
- Browser timeline: scrub/play muted preview, multiple clips, image/audio sources, trims, split, reorder, volume, hook text, undo/redo, autosave, color presets, and formats.
- Native FFmpeg MP4 rendering with hook overlays, source audio/audio tracks, dimensions/duration verification, and downloadable results.
- 2–26 frozen hook or shot-segmentation variants with revision lineage.
- Sandbox scheduling, approval, batch approval, cancellation, worker execution, and sandbox post history.
- Manual metric snapshots, explicitly labeled synthetic observations, conservative Wilson intervals, comparable-window/exposure checks, and follow-up experiment creation.

## External integrations and limits

**This is a working personal-deployment foundation, not a completed hosted SaaS.** Live Instagram/YouTube/TikTok OAuth, Trial Reel posting, and automatic insights collection are not implemented. No external post is published. Automatic video analysis/OCR, transcription, automatic trend discovery, advanced transitions, AI edit operations, and multi-tenant team accounts remain future work.

The current persistence is SQLite + disk, not Supabase/Postgres. One authenticated owner may access all their brands; brand scoping is not tenant isolation between unrelated users. Do not use this version to host multiple customer organizations. A persistent Node host is required; the current database/media implementation cannot be deployed unchanged to Vercel serverless.

OpenRouter code is checked against the pinned upstream API implementation and mock tests, not a paid live call. Curated catalog availability/pricing can change. Video download currently accepts OpenRouter-owned HTTPS hosts only and deliberately rejects unknown output hosts rather than forwarding credentials. See `docs/PROVIDER_INTEGRATIONS.md`.

Shot-segmentation experiments split continuous source footage without changing scene selection; this is not a full automatic recut engine. Preview playback is muted, with CSS color approximation; exported audio and color are encoded by FFmpeg. MP4 generation is a worker task, never a browser recording.

## Verify

```sh
npm run typecheck
npm test
npm run build
```

To include the real media integration test, set `FFMPEG_PATH=ffmpeg` and `FFPROBE_PATH=ffprobe` (or absolute paths) before `npm test`. Browser journey instructions are in `docs/TESTING.md`.

Start with `docs/IMPLEMENTATION_STATUS.md` for completion evidence and prioritized remaining work. Source provenance and license decisions are in `docs/OPEN_SOURCE_AUDIT.md`.
