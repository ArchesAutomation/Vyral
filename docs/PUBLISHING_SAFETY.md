# Publishing behavior

Real external publishing is absent. The UI clearly labels sandbox posts and disconnected social accounts. A creative must have a render output before it can be scheduled. Every queued post starts NEEDS_APPROVAL. Approval records its timestamp and creates a durable, idempotent job. Sandbox batch approval is explicit. The worker refuses a non-sandbox provider or an unapproved post. Cancellation removes queued work. Published records preserve the approved creative revision and output asset.

Trial mode in this version is internal sandbox metadata only. It does not call Meta, distribute to non-followers, or graduate content. No winner is promoted automatically. Mock posts never become real analytics. Analytics arrive only through manual imports and retain a synthetic/real distinction.

Before real integrations: add frozen approval payload hashes, token lifecycle management, per-account caps and spacing, platform quotas, duplicate protection, revocation/emergency pause, provider publish idempotency, and separate automatic graduation authorization. Test with mock providers before any authorized account call.
