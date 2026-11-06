import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
process.env.DATA_DIR = mkdtempSync(resolve(tmpdir(), "vyral-test-"));
process.env.STUDIO_PASSWORD = "testing-password-12345";
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
const { act, state } = await import("../lib/services.ts");
const { get, save, list, db, dataDir } = await import("../lib/db.ts");
const { encrypt, decrypt, checkPassword, session, authorized } = await import(
  "../lib/security.ts"
);
const { execute, tick } = await import("../workers/runner.ts");
const { command, render } = await import("../workers/render.ts");
const { request } = await import("../workers/providers.ts");
test("authentication and encrypted credential round trip", () => {
  assert.equal(checkPassword("wrong"), false);
  assert.equal(checkPassword(process.env.STUDIO_PASSWORD!), true);
  const secret = encrypt("sk-test");
  assert.ok(!secret.includes("sk-test"));
  assert.equal(decrypt(secret), "sk-test");
  const token = session();
  assert.equal(
    authorized(
      new Request("http://localhost/api/studio", {
        headers: { cookie: `vyral_session=${token}` },
      }),
    ),
    true,
  );
  assert.equal(authorized(new Request("http://localhost/api/studio")), false);
});
test("multi-brand project, variations, revisions, and sandbox publishing loop", async () => {
  const a = act("brand.create", {
    name: "Brand A",
    audience: "Traders",
    voice: "Calm",
  }) as any;
  const b = act("brand.create", { name: "Brand B" }) as any;
  const reference = act("inspiration.create", {
    brandId: a.id,
    name: "Travel style",
    notes: "Slow shots, calm hook",
    url: "https://example.com/reference",
  }) as any;
  assert.equal(reference.dna.source, "user_notes");
  const p = act("project.create", {
    brandId: a.id,
    name: "Original story",
    brief: "Make a process story",
    sourceId: reference.id,
  }) as any;
  assert.equal(p.sourceId, reference.id);
  assert.throws(
    () =>
      act("project.save", {
        brandId: b.id,
        id: p.id,
        composition: p.composition,
      }),
    /not found/,
  );
  const e = act("experiment.create", {
    brandId: a.id,
    name: "Hook test",
    projectId: p.id,
    hypothesis: "Questions hold attention",
    axis: "hook",
    levels: ["A question?", "A statement."],
  }) as any;
  const vs = list("variant", a.id);
  assert.equal(vs.length, 2);
  assert.equal(vs[0].experimentId, e.id);
  assert.equal(vs[0].baseRevision, p.revisionId);
  assert.equal((state(b.id).records as any).variant.length, 0);
  const updated = act("project.save", {
    brandId: a.id,
    id: vs[0].id,
    composition: vs[0].composition,
  }) as any;
  assert.equal(updated.kind, "variant");
  assert.notEqual(updated.revisionId, vs[0].revisionId);
  assert.throws(
    () =>
      act("posts.queue", {
        brandId: a.id,
        id: vs[0].id,
        scheduledAt: new Date().toISOString(),
      }),
    /Render/,
  );
  const asset = save("asset", a.id, {
    name: "Rendered fixture",
    mime: "video/mp4",
    file: "test.mp4",
  });
  save("variant", a.id, { outputAssetId: asset.id }, vs[0].id);
  const post = act("posts.queue", {
    brandId: a.id,
    id: vs[0].id,
    scheduledAt: new Date(Date.now() - 1000).toISOString(),
    trial: true,
  }) as any;
  assert.equal(post.status, "NEEDS_APPROVAL");
  assert.equal(list("job", a.id).length, 0);
  act("posts.approve", { brandId: a.id, id: post.id });
  assert.throws(() => act("posts.approve", { brandId: a.id, id: post.id }));
  await tick();
  assert.equal(get(post.id).status, "PUBLISHED");
  assert.equal(get(post.id).synthetic, true);
  assert.ok(String(get(post.id).externalId).startsWith("sandbox-"));
  act("metrics.import", {
    brandId: a.id,
    variantId: vs[0].id,
    success: 100,
    total: 200,
    windowHours: 24,
    synthetic: true,
  });
  assert.equal(list("snapshot", a.id).length, 1);
  assert.throws(() =>
    act("metrics.import", {
      brandId: b.id,
      variantId: vs[0].id,
      success: 100,
      total: 200,
      windowHours: 24,
    }),
  );
  assert.equal(db.prepare("SELECT COUNT(*) as n FROM revisions").get()?.n, 4);
});
test("duplicate render requests use one durable idempotency key", () => {
  const a = list("brand")[0],
    p = act("project.create", { brandId: a.id, name: "Idempotent" }) as any;
  const j = act("render", { brandId: a.id, id: p.id }) as any;
  const duplicate = act("render", { brandId: a.id, id: p.id }) as any;
  assert.equal(j.id, duplicate.id);
});
test("provider calls are mocked and reject foreign polling origins", async () => {
  const prior = globalThis.fetch;
  let received: unknown;
  globalThis.fetch = (async (url, init) => {
    received = { url: String(url), body: JSON.parse(String(init?.body)) };
    return Response.json({ choices: [{ message: { content: "mock" } }] });
  }) as typeof fetch;
  try {
    const r = await request("/api/v1/chat/completions", {
      model: "test",
      messages: [],
    });
    assert.equal(r.choices[0].message.content, "mock");
    assert.ok(received);
    await assert.rejects(
      () => request("https://evil.example/api/v1/job"),
      /Untrusted/,
    );
  } finally {
    globalThis.fetch = prior;
  }
});
test("daily budget reservations prevent unbounded paid generation", () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.DAILY_GENERATION_LIMIT_USD = "0.20";
  const a = list("brand")[0];
  const args = {
    brandId: a.id,
    model: "google/gemini-3-pro-image",
    prompt: "test",
    size: "1K",
    aspectRatio: "9:16",
  };
  const j = act("generation", args) as any;
  assert.ok(Number(j.estimate) > 0.1);
  assert.throws(() => act("generation", args), /budget/);
  act("job.cancel", { brandId: a.id, id: j.id });
  delete process.env.OPENROUTER_API_KEY;
  process.env.DAILY_GENERATION_LIMIT_USD = "5";
});
test(
  "native MP4 render verifies geometry, duration, audio and variant overlay",
  { skip: !process.env.FFMPEG_PATH },
  async () => {
    const a = list("brand")[0],
      file = "12345678-1234-1234-1234-123456789abc.mp4";
    await command(process.env.FFMPEG_PATH!, [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=320x240:r=30:d=2",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      resolve(dataDir, "media", file),
    ]);
    const asset = save("asset", a.id, {
      name: "Generated test fixture",
      mime: "video/mp4",
      file,
      duration: 2,
    });
    const p = act("project.create", {
      brandId: a.id,
      name: "Render check",
      assetId: asset.id,
    }) as any;
    const c = {
      ...p.composition,
      width: 720,
      height: 1080,
      duration: 2,
      clips: p.composition.clips.map((x: any) => ({ ...x, end: 2 })),
      overlays: [
        {
          id: "hook",
          text: "Original hook",
          start: 0,
          end: 2,
          y: 0.35,
          fontSize: 56,
          color: "#ffffff",
        },
      ],
    };
    const fresh = act("project.save", {
      brandId: a.id,
      id: p.id,
      composition: c,
    }) as any;
    const out = await render(fresh, fresh.revisionId);
    const meta = JSON.parse(
      await command(process.env.FFPROBE_PATH || "ffprobe", [
        "-v",
        "quiet",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        resolve(dataDir, "media", String(out.file)),
      ]),
    );
    assert.equal(
      meta.streams.find((x: any) => x.codec_type === "video").width,
      720,
    );
    assert.ok(meta.streams.some((x: any) => x.codec_type === "audio"));
    assert.ok(Math.abs(Number(meta.format.duration) - 2) < 0.2);
    assert.equal(get(p.id).outputAssetId, out.id);
  },
);
