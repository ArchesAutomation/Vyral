const { test } = require("node:test");
const assert = require("node:assert/strict");
const { deploy, releaseContext } = require("../scripts/deploy-cloudflare.cjs");
const env = {
  GITHUB_ACTIONS: "true",
  GITHUB_EVENT_NAME: "push",
  GITHUB_REF: "refs/heads/main",
  GITHUB_REPOSITORY: "ArchesAutomation/Vyral",
  GITHUB_SHA: "a".repeat(40),
  GITHUB_TOKEN: "github-test",
  CLOUDFLARE_API_TOKEN: "cloudflare-test",
  VYRAL_OWNER_PASSWORD: "qa-only-password",
  CLOUDFLARE_ACCOUNT_ID: "b".repeat(32),
};
const config = {
  name: "vyral",
  main_module: "worker.js",
  bindings: [{ name: "STUDIO_ID", type: "plain_text", text: "owner" }],
};
const response = (data, status = 200) => Response.json(data, { status });
function fixture({ directPush = false, newer = false } = {}) {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("/git/ref/"))
      return response({
        object: { sha: newer ? "c".repeat(40) : env.GITHUB_SHA },
      });
    if (url.endsWith("/pulls"))
      return response(
        directPush
          ? []
          : [
              {
                merged_at: "2026-11-06",
                base: { ref: "main" },
                merge_commit_sha: env.GITHUB_SHA,
              },
            ],
      );
    if (url.startsWith("https://api.cloudflare.com/"))
      return response({
        success: true,
        result: { deployment_id: "test-deployment" },
      });
    if (url.includes("/api/studio")) return response({ configured: true }, 401);
    return new Response("<title>Vyral</title>");
  };
  return {
    calls,
    options: {
      env,
      request,
      read: (file) =>
        file.endsWith(".json") ? JSON.stringify(config) : "export default {}",
      log: () => {},
    },
  };
}
test("production release rejects local, PR and non-main execution", () => {
  for (const changes of [
    { GITHUB_ACTIONS: "false" },
    { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_REF: "refs/heads/feature" },
    { CLOUDFLARE_API_TOKEN: "" },
    { VYRAL_OWNER_PASSWORD: "" },
    { VYRAL_OWNER_PASSWORD: "short" },
  ])
    assert.throws(() => releaseContext({ ...env, ...changes }));
});
test("direct pushes and superseded commits never reach Cloudflare", async () => {
  let f = fixture({ directPush: true });
  await assert.rejects(deploy(f.options), /not an associated merged PR/);
  assert.ok(
    !f.calls.some((c) => c.url.startsWith("https://api.cloudflare.com/")),
  );
  f = fixture({ newer: true });
  assert.deepEqual(await deploy(f.options), { skipped: true });
  assert.equal(f.calls.length, 1);
});
test("merged verified release preserves secret bindings and checks private live API", async () => {
  const f = fixture();
  const result = await deploy(f.options);
  assert.equal(result.deployed, true);
  const upload = f.calls.find((c) =>
    c.url.startsWith("https://api.cloudflare.com/"),
  );
  const metadata = JSON.parse(await upload.options.body.get("metadata").text());
  assert.deepEqual(metadata.bindings.slice(-3, -1), [
    { name: "ENCRYPTION_KEY", type: "inherit" },
    { name: "SETUP_TOKEN_HASH", type: "inherit" },
  ]);
  assert.ok(!JSON.stringify(metadata).includes("cloudflare-test"));
  assert.deepEqual(metadata.bindings.at(-1), {
    name: "STUDIO_PASSWORD", type: "secret_text", text: env.VYRAL_OWNER_PASSWORD,
  });
  assert.ok(f.calls.some((c) => c.url.includes("/api/studio")));
});

