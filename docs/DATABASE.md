# Database

Schema is created idempotently at startup in `lib/db.ts`.

| Table | Purpose |
| --- | --- |
| records | Typed JSON records with indexed kind and brand scope, immutable IDs and creation timestamps |
| revisions | Append-only composition JSON, project/variant ID, brand, revision ID, creation time |
| secrets | Encrypted credentials; never returned to the client |
| sessions | SHA-256 of random session tokens with expiry |
| worker_health | Most recent worker heartbeat |

Record kinds: brand, inspiration, project, asset, experiment, variant, post, snapshot, job, audit. Relationships are preserved through IDs in JSON and validated in application services. Published creatives retain a composition revision, output asset, project/variant, experiment, and brand. Source assets preserve upload/generation/render provenance. Variants freeze their base revision. Snapshot records preserve the original manual import payload and source classification.

This consolidated SQLite schema prioritizes a runnable personal deployment; it is not the normalized PostgreSQL/RLS schema in the full product brief. Large data volumes need pagination, indexed normalized relationships, data retention, and a migration framework. There is no customer tenant security boundary beyond the authenticated owner.

Back up the database, media directory, and encryption key together. For a consistent copy, stop both services or use SQLite’s online backup API. Do not copy only the main database file while WAL writes are active.
