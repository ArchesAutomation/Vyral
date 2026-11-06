<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Vyral repository guidelines

Read docs/IMPLEMENTATION_STATUS.md and docs/ARCHITECTURE.md before extending the application. Preserve the distinction between sandbox and real publishing, manual and measured DNA, synthetic and real metrics, and single-owner brands versus independent tenants. Never expose credentials in browser responses. Keep paid calls and live posts out of default tests. Retain vendor MIT notices. Run typecheck, tests, and production build for changes across workflow boundaries.
