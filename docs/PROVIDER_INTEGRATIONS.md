# Provider integrations

## OpenRouter

Set the server environment key or enter a key in Settings with a valid AES encryption key. The environment key takes precedence. Secrets never enter state responses. Reused Open Higgsfield catalog and payload builders handle aspect ratios, model-specific resolution/duration, first/last frames, image references, and audio flags. Catalog upstream verification badges are inherited evidence, not a claim that Vyral performed live paid tests.

The worker supports chat image payloads, the pinned upstream `/images/generations` path, `/videos` submission, durable polling, and output asset records. Current official image docs also describe `/api/v1/images`; compatibility between that newer path and the pinned upstream endpoint has not been paid-tested. See https://openrouter.ai/docs/guides/overview/multimodal/image-generation . Provider response drift is a known activation risk.

Daily estimated reservations are global to the personal installation; image/video estimates come from the pinned catalog and scripts reserve $0.25. Reservations prevent queued work from skipping the estimate cap, but unknown final provider costs are not a strict financial guarantee. Set a matching hard spend limit in OpenRouter. No automatic paid resubmission occurs after an unknown submission outcome.

Video completion downloads accept only HTTPS OpenRouter hosts with redirects disabled. Unknown storage/CDN hosts are rejected pending a reviewed allowlist and credential policy. This can block otherwise legitimate provider outputs. Requests and polling are mocked in tests. No live generation was run and no credits were spent.

## Social platforms

Only the sandbox provider is implemented. It persists approval, schedule, Trial-like distribution metadata, queue execution, and synthetic external IDs. It never contacts a platform. Real Instagram Login OAuth, Meta app review, permission checks, account eligibility, token refresh, quotas, Trial Reel creation/graduation, and insights sync remain unimplemented. YouTube/TikTok are also export-only. Current platform requirements must be verified against official documentation before adding those adapters.

No OAuth connection or automatic analytics is represented as active. Manual MP4 export works. Metrics are manual imports with explicit source/observation windows.

## Activating safely

1. Configure a small OpenRouter budget and a valid key.
2. Validate the selected model is currently offered with the expected endpoint and payload.
3. Run one explicitly authorized low-cost generation and verify provider billing/output storage.
4. Before implementing social APIs, register the platform app and obtain approved scopes for a test professional account.
5. Add signed credential callbacks, encrypted tokens, quotas, account capabilities, and mock integration tests before authorizing any real posting.
