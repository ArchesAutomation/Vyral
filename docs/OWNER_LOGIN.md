# Owner login

The single studio owner signs in with username `Nick`. This does not introduce team accounts or a separate authentication service.

Before merging this PR, add the repository Actions secret `VYRAL_OWNER_PASSWORD` in GitHub Settings → Secrets and variables → Actions. Enter the desired password directly in GitHub; never put it in source, an issue, a PR description, a command, or a log. Accepted length is 8–200 characters.

The approved-main deployment reads this secret into memory and uploads it as a Cloudflare `secret_text` binding named `STUDIO_PASSWORD` alongside the verified Worker. The password is never bundled into browser assets or checked-in deployment metadata. Deployment fails before any Cloudflare mutation if this secret is absent or invalid. Existing encryption and setup bindings are inherited unchanged. Keep the Actions secret configured for future deployments.

Cloudflare authenticates against the private binding when present, so the one-time setup page is unnecessary after a configured deployment. Without the binding, the pre-existing salted-password database flow remains supported. The Next.js self-hosted version uses its private STUDIO_PASSWORD environment variable. Both backends require the Nick username. Existing login throttles and secure, HTTP-only session cookies remain in place; this does not revoke previously active sessions.

Credential changes follow the same PR approval and CI/CD policy as other configuration changes. Do not set a Worker secret directly or deploy a local branch to bypass review. The password value itself is entered by the owner in GitHub's private secret settings, outside source control.
