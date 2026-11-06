import { db, list, get, save, transaction, audit } from "../lib/db.ts";
import { render } from "./render.ts";
import { generation, script } from "./providers.ts";
import type { Row } from "../lib/domain.ts";
export async function execute(job: Row) {
  const p = job.payload as Record<string, unknown>;
  if (job.type === "render")
    return {
      assetId: (
        await render(get(String(p.id), job.brandId), String(p.revisionId))
      ).id,
    };
  if (job.type === "generation") return generation(job);
  if (job.type === "script") return script(job);
  if (job.type === "publish") {
    const post = get(String(p.postId), job.brandId);
    if (post.provider !== "sandbox")
      throw Error("Live social provider is not configured");
    if (!post.approvedAt || post.status !== "QUEUED")
      throw Error("Publishing approval required");
    save(
      "post",
      job.brandId,
      {
        status: "PUBLISHED",
        externalId: "sandbox-" + post.id,
        publishedAt: new Date().toISOString(),
        synthetic: true,
      },
      post.id,
    );
    audit(job.brandId, "Sandbox post completed", { post: post.id });
    return { sandbox: true };
  }
  throw Error("Unknown job type");
}
export async function tick() {
  db.prepare(
    "INSERT INTO worker_health VALUES(1,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen",
  ).run(new Date().toISOString());
  const job = transaction(() => {
    const now = Date.now();
    for (const j of list("job").filter(
      (j) => j.status === "running" && Date.parse(String(j.leaseUntil)) < now,
    )) {
      // Do not automatically resubmit a paid request whose outcome may be unknown.
      save(
        "job",
        j.brandId,
        {
          status:
            ["generation", "script"].includes(String(j.type)) && !j.pollingUrl
              ? "failed"
              : "queued",
          error:
            "Worker stopped during request; review provider history before resubmitting",
          runAt: new Date().toISOString(),
        },
        j.id,
      );
    }
    const j = list("job")
      .reverse()
      .find((j) => j.status === "queued" && Date.parse(String(j.runAt)) <= now);
    return j
      ? save(
          "job",
          j.brandId,
          {
            status: "running",
            leaseUntil: new Date(now + 360000).toISOString(),
            attempts: Number(j.attempts || 0) + 1,
          },
          j.id,
        )
      : null;
  });
  if (!job) return false;
  try {
    const result = await execute(job);
    if (!("pending" in result && result.pending))
      save(
        "job",
        job.brandId,
        {
          status: "completed",
          result,
          ...("costUsd" in result ? { costUsd: result.costUsd } : {}),
          completedAt: new Date().toISOString(),
        },
        job.id,
      );
  } catch (e) {
    save(
      "job",
      job.brandId,
      { status: "failed", error: (e as Error).message },
      job.id,
    );
    audit(job.brandId, "Job failed", { job: job.id, type: job.type });
  }
  return true;
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/runner.ts")) {
  console.log("Vyral worker running. Live publishing disabled.");
  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });
  while (!stopping) {
    await tick();
    await new Promise((r) => setTimeout(r, 2000));
  }
}
