<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Vyral repository guidelines

Read docs/IMPLEMENTATION_STATUS.md and docs/ARCHITECTURE.md before extending the application. Preserve the distinction between sandbox and real publishing, manual and measured DNA, synthetic and real metrics, and single-owner brands versus independent tenants. Never expose credentials in browser responses. Keep paid calls and live posts out of default tests. Retain vendor MIT notices. Run typecheck, tests, and production build for changes across workflow boundaries.

## Required GitHub review and release workflow

GitHub is the source of truth. All code, configuration, infrastructure, deployment, and instruction changes must be committed to a feature branch and submitted as a pull request. Never push directly to `main` or another production branch.

Nick must explicitly approve a PR before it is merged. Do not merge a PR or enable auto-merge on his behalf without his explicit approval for that PR. Opening a PR and passing tests are not approval to merge.

Production releases must run automatically through the repository's CI/CD pipeline after an approved PR is merged into the production branch and required checks pass. Never deploy an unmerged branch or local working copy directly using hosting plugins, APIs, CLIs, or dashboards. Preserve the live deployment while a PR awaits approval. Production rollbacks and infrastructure changes follow the same review process.

Keep complete editable source and deployment configuration in GitHub. If deployment automation or its credentials are missing, prepare the configuration in a PR and report the setup blocker. Never bypass the workflow with a direct deployment. Never commit credentials or setup tokens. Verify deployment after the approved merge. See `docs/RELEASE_WORKFLOW.md`.
