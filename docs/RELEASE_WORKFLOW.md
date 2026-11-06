# GitHub review and production releases

This policy applies to every Vyral change, including agent instructions, UI, infrastructure, and deployment configuration. It also records Nick's global working preference: feature branch → pull request → Nick's explicit approval → merge → automatic production deployment. Agents must not merge, enable auto-merge, push to main, or deploy local/unmerged code without the corresponding explicit approval.

`AGENTS.md` contains the repository rule. Nick's account-wide ChatGPT custom instructions contain the same global preference. The local Codex global file at `C:\Users\Owner\.codex\AGENTS.md` could not be updated because this session cannot write outside its allowed workspace. Account instructions and repository files are distinct scopes.

## Pipeline

The Studio checks workflow verifies code on branches and PRs. On a main push, a separate production job waits for those checks, downloads the exact verified Worker artifact, checks that the commit is current main and belongs to a merged PR, and deploys it. The production job is never run by a PR event. The deployment script preserves the existing Worker encryption/setup secrets through inherited bindings and checks the public page and unauthenticated private API afterward. There is no manual deployment trigger.

The agent's instruction to wait for Nick's approval remains essential. The pipeline checks PR merge provenance; it does not independently prove Nick approved a PR. Configure repository protection/permissions to match the team's review process. For a single-owner repository, the owner merging the PR is the approval action; GitHub does not let authors approve their own PR review.

## One-time activation

Before merging the setup PR, add a repository or production-environment GitHub Actions secret named `CLOUDFLARE_API_TOKEN` with Workers Scripts Edit permission for the existing Cloudflare account. The account ID is public configuration in the workflow. Use a scoped deployment token; never paste it into chat or commit it. Existing Worker secrets must already be configured and must be preserved. The connected ChatGPT Cloudflare plugin's credentials are not automatically available to GitHub Actions.

The first approved merge activates the workflow. Without the deployment secret, verification can pass but deployment fails clearly and keeps the previous site running. This setup PR has not been merged or deployed by the agent. Live automatic deployment cannot be claimed until credentials are connected and an approved merged run passes.

Prefer GitHub branch protection/rulesets requiring PRs and the verify check; do not silently enable requirements that prevent a sole repository owner from merging their own work. Configure those settings only through a reviewed request.

When a release fails, diagnose it and prepare a corrective PR or reviewed revert. Never bypass the process using the hosting dashboard or a plugin. Never regenerate the encryption key during routine deployment. Keep source, deployment scripts, and configuration in GitHub.
