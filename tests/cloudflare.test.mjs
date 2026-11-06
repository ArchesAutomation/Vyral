import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
execFileSync(process.execPath, ["scripts/build-cloudflare.cjs"]);
const built = fs
  .readFileSync(".cloudflare/worker.js", "utf8")
  .replace(
    /import \* as (\w+) from "cloudflare:workers";/,
    "const $1={DurableObject:class {constructor(ctx,env){this.ctx=ctx;this.env=env;}}};",
  );
fs.writeFileSync(".cloudflare/test-worker.mjs", built);
const { VyralStudio } = await import(
  pathToFileURL(path.resolve(".cloudflare/test-worker.mjs")).href
);
function fixture(overrides = {}) {
  const sqlite = new DatabaseSync(":memory:"),
    objects = new Map();
  let alarm = null;
  const ctx = {
    storage: {
      sql: {
        exec(sql, ...args) {
          if (sql.split(";").filter((x) => x.trim()).length > 1) {
            sqlite.exec(sql);
            return { toArray: () => [] };
          }
          const rows = sqlite.prepare(sql).all(...args);
          return { toArray: () => rows };
        },
      },
      transactionSync(fn) {
        sqlite.exec("BEGIN");
        try {
          const value = fn();
          sqlite.exec("COMMIT");
          return value;
        } catch (e) {
          sqlite.exec("ROLLBACK");
          throw e;
        }
      },
      async setAlarm(time) {
        alarm = time;
      },
      async deleteAlarm() {
        alarm = null;
      },
    },
  };
  const env = {
    ...overrides,
    ENCRYPTION_KEY: "ab".repeat(32),
    SETUP_TOKEN_HASH: createHash("sha256")
      .update("test-setup-token")
      .digest("hex"),
    MEDIA: {
      async put(key, bytes) {
        objects.set(key, new Uint8Array(bytes));
      },
      async get(key) {
        const bytes = objects.get(key);
        return bytes
          ? {
              body: new Blob([bytes]).stream(),
              size: bytes.length,
              httpEtag: '"test"',
            }
          : null;
      },
      async delete(key) {
        objects.delete(key);
      },
    },
  };
  let studio = new VyralStudio(ctx, env),
    cookie = "";
  const fetch = async (path = "/api/studio", body, extra = {}) => {
    const r = await studio.fetch(
      new Request("https://vyral.test" + path, {
        method: body ? "POST" : "GET",
        headers: { cookie, ...extra },
        ...(body
          ? { body: body instanceof FormData ? body : JSON.stringify(body) }
          : {}),
      }),
    );
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return r;
  };
  return {
    fetch,
    objects,
    get alarm() {
      return alarm;
    },
    restart() {
      studio = new VyralStudio(ctx, env);
    },
    tick: () => studio.alarm(),
  };
}
test("Cloudflare authenticated persistence, R2 export, origin checks and durable sandbox alarm", async () => {
  const f = fixture();
  let r = await f.fetch();
  assert.equal(r.status, 401);
  assert.equal((await r.json()).setupRequired, true);
  r = await f.fetch("/api/studio", {
    action: "setup",
    username: "Nick",
    token: "wrong",
    password: "correct-password-for-tests",
  });
  assert.equal(r.status, 403);
  r = await f.fetch("/api/studio", {
    action: "setup",
    username: "Nick",
    token: "test-setup-token",
    password: "correct-password-for-tests",
  });
  assert.equal(r.status, 200);
  r = await f.fetch("/api/studio", {
    action: "setup",
    username: "Nick",
    token: "test-setup-token",
    password: "another-password-for-tests",
  });
  assert.equal(r.status, 403);
  r = await f.fetch(
    "/api/studio",
    { action: "brand.create", name: "QA brand" },
    { origin: "https://evil.test" },
  );
  assert.equal(r.status, 403);
  const call = async (action, data = {}) => {
    const r = await f.fetch("/api/studio", { action, ...data });
    const b = await r.json();
    assert.equal(r.status, 200, JSON.stringify(b));
    return b.result;
  };
  const brand = await call("brand.create", { name: "QA brand" });
  const form = new FormData();
  form.set("brandId", brand.id);
  form.set(
    "file",
    new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], {
      type: "image/png",
    }),
    "fixture.png",
  );
  r = await f.fetch("/api/media", form);
  assert.equal(r.status, 200);
  const asset = await r.json();
  assert.equal(f.objects.size, 1);
  const project = await call("project.create", {
    brandId: brand.id,
    name: "QA project",
    assetId: asset.id,
  });
  const job = await call("render", { brandId: brand.id, id: project.id });
  assert.equal(job.type, "browser-render");
  assert.deepEqual(
    job.composition,
    project.composition,
    "Export must use the server revision, not stale client state",
  );
  assert.ok(f.alarm > Date.now());
  const output = new FormData();
  output.set("brandId", brand.id);
  output.set("renderJobId", job.id);
  output.set(
    "file",
    new Blob(
      [new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109])],
      { type: "video/mp4" },
    ),
    "output.mp4",
  );
  r = await f.fetch("/api/media", output);
  assert.equal(r.status, 200);
  const rendered = await r.json();
  r = await f.fetch("/api/media/" + rendered.id);
  assert.equal(r.status, 200);
  assert.equal((await r.arrayBuffer()).byteLength, 12);
  f.restart();
  r = await f.fetch();
  const state = await r.json();
  assert.equal(state.renderMode, "browser");
  assert.equal(state.records.project[0].outputAssetId, rendered.id);
  assert.equal(state.records.job[0].status, "completed");
  const post = await call("posts.queue", {
    brandId: brand.id,
    id: project.id,
    scheduledAt: new Date().toISOString(),
  });
  await call("posts.approve", { brandId: brand.id, id: post.id });
  assert.ok(f.alarm);
  await f.tick();
  r = await f.fetch();
  const final = await r.json();
  assert.equal(final.records.post[0].status, "PUBLISHED");
  assert.equal(final.records.post[0].synthetic, true);
  await call("logout");
  r = await f.fetch("/api/media/" + rendered.id);
  assert.equal(r.status, 401);
  r = await f.fetch("/api/studio", { action: "login", password: "incorrect" });
  assert.equal(r.status, 401);
  r = await f.fetch("/api/studio", {
    action: "login",
    username: "Nick",
    password: "correct-password-for-tests",
  });
  assert.equal(r.status, 200);
});

test("private deployment credentials enforce Nick login and keep secrets out of responses", async () => {
  const f = fixture({ STUDIO_PASSWORD: "qa-test1" });
  let r = await f.fetch();
  assert.equal(r.status, 401);
  const unauthenticated = await r.json();
  assert.equal(unauthenticated.setupRequired, false);
  assert.ok(!JSON.stringify(unauthenticated).includes("qa-test1"));
  for (const username of [undefined, "Other", "nick"]) {
    r = await f.fetch("/api/studio", { action: "login", username, password: "qa-test1" });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get("set-cookie"), null);
  }
  r = await f.fetch("/api/studio", { action: "login", username: "Nick", password: "incorrect" });
  assert.equal(r.status, 401);
  r = await f.fetch("/api/studio", { action: "login", username: "Nick", password: "qa-test1" });
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("set-cookie").includes("HttpOnly"));
  assert.ok(!(await r.text()).includes("qa-test1"));
  r = await f.fetch();
  assert.equal(r.status, 200);
});

