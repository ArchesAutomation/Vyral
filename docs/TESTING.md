# Verification

Automated tests run with Node’s built-in runner and temporary isolated SQLite databases. Default CI never calls a paid model or publishes externally.

```sh
npm run typecheck
npm test
npm run build
```

Set FFMPEG_PATH and FFPROBE_PATH to include real native media rendering. The media test is explicitly skipped when FFMPEG_PATH is absent. It creates its own licensed-free test fixture, renders H.264/AAC with text, and validates dimensions, duration, and audio through FFprobe.

Coverage includes composition validation, mutation isolation, A–Z definitions, exact source trims, factorial count limits, known Wilson values, missing/exposure/window checks, synthetic mixing rejection, upstream payload rules, color clamping, owner sessions, encryption, cross-brand mutation rejection, revisions, publishing approval/idempotency, sandbox execution, provider URL rejection/mocks, and paid estimate reservations.

## Browser journey

Use a fresh test DATA_DIR and configure the server password as `vyral-e2e-test-password` (test only). Start `npm run dev`, then:

```sh
node tests/e2e.mjs
```

Requires locally installed Chrome or `BROWSER_CHANNEL` for another installed Playwright-supported channel. Set TEST_URL and TEST_PASSWORD to target a different local setup. The script creates a clearly named QA brand; keep it away from a production database. It covers sign-in, brand creation, saving and inspecting inspiration, adapting a project, editing/autosave, variants, explicitly synthetic measurements, analytics, every navigation destination, and desktop/mobile overflow. Screenshots stay in ignored test-results and are verification artifacts, not user assets.

The extended browser journey uses `TEST_MEDIA=/absolute/path/source.png` and a running worker with the same test DATA_DIR. It additionally verifies a real upload, native MP4 and variant renders, authenticated full/range download, a scheduled post, explicit approval, and completed sandbox execution. Use an original generated PNG named `source.png` for this fixture.

Local results: 19 automated checks passed with the native media test enabled. The production browser journey passed at 1440px desktop and 390px mobile with no page errors or horizontal overflow. Development-mode testing surfaced an unhandled Event from Next development tooling in this environment; the production build did not reproduce it. A same-origin sign-in defect caught during browser testing was fixed and retested.

Live-provider tests are intentionally not run: no OpenRouter key, authorized social test account, or paid/live test flag was provided. Docker/remote CI and production deployment require their own verification.
