const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

function releaseContext(env) {
  if (
    env.GITHUB_ACTIONS !== "true" ||
    env.GITHUB_EVENT_NAME !== "push" ||
    env.GITHUB_REF !== "refs/heads/main"
  )
    throw Error(
      "Production deployment requires a GitHub Actions main-branch push after PR merge",
    );
  if (
    env.GITHUB_REPOSITORY !== "ArchesAutomation/Vyral" ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || "")
  )
    throw Error("Unexpected repository or commit");
  if (
    !env.GITHUB_TOKEN ||
    !env.CLOUDFLARE_API_TOKEN ||
    !/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID || "")
  )
    throw Error(
      "Deployment credentials are missing. Configure CLOUDFLARE_API_TOKEN in GitHub Actions secrets; do not deploy manually",
    );
  return { repository: env.GITHUB_REPOSITORY, sha: env.GITHUB_SHA };
}

function uploadMetadata(config) {
  if (
    config.name !== "vyral" ||
    config.main_module !== "worker.js" ||
    config.bindings?.find((b) => b.name === "STUDIO_ID")?.text !== "owner"
  )
    throw Error("Unexpected production deployment configuration");
  if (
    config.migrations ||
    config.bindings.some((b) => b.type === "secret_text")
  )
    throw Error(
      "Migrations and secret values require a separate reviewed setup; they must not enter routine uploads",
    );
  const { name, ...metadata } = config;
  return {
    ...metadata,
    bindings: [
      ...config.bindings,
      { name: "ENCRYPTION_KEY", type: "inherit" },
      { name: "SETUP_TOKEN_HASH", type: "inherit" },
    ],
  };
}

async function deploy({
  env = process.env,
  request = fetch,
  read = (file) => fs.readFileSync(path.join(root, file), "utf8"),
  log = console.log,
} = {}) {
  const context = releaseContext(env);
  const gh = async (route) => {
    const r = await request(
      "https://api.github.com/repos/" + context.repository + route,
      {
        headers: {
          Authorization: "Bearer " + env.GITHUB_TOKEN,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (!r.ok)
      throw Error("GitHub release verification failed (" + r.status + ")");
    return r.json();
  };
  const current = await gh("/git/ref/heads/main");
  if (current.object?.sha !== context.sha) {
    log("A newer main commit exists; skipping this superseded deployment");
    return { skipped: true };
  }
  const prs = await gh("/commits/" + context.sha + "/pulls");
  if (
    !Array.isArray(prs) ||
    !prs.some(
      (pr) =>
        pr.merged_at &&
        pr.base?.ref === "main" &&
        pr.merge_commit_sha === context.sha,
    )
  )
    throw Error(
      "This commit is not an associated merged PR; direct main pushes cannot deploy",
    );
  const metadata = uploadMetadata(
    JSON.parse(read("cloudflare/deployment.json")),
  );
  const code = read(".cloudflare/worker.js");
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append(
    "worker.js",
    new Blob([code], { type: "application/javascript+module" }),
    "worker.js",
  );
  const response = await request(
    "https://api.cloudflare.com/client/v4/accounts/" +
      env.CLOUDFLARE_ACCOUNT_ID +
      "/workers/scripts/vyral",
    {
      method: "PUT",
      headers: { Authorization: "Bearer " + env.CLOUDFLARE_API_TOKEN },
      body: form,
    },
  );
  if (!response.ok)
    throw Error(
      "Cloudflare deployment failed (" +
        response.status +
        "); production was not verified",
    );
  const result = await response.json();
  if (!result.success) throw Error("Cloudflare rejected deployment");
  log(
    "Deployed verified GitHub commit " +
      context.sha +
      " as " +
      result.result?.deployment_id,
  );
  const live = await request(
    "https://vyral.archesautomation.workers.dev/?release=" + context.sha,
    { redirect: "error" },
  );
  if (!live.ok || !(await live.text()).includes("Vyral"))
    throw Error("Post-deployment page check failed; inspect Cloudflare logs");
  const api = await request(
    "https://vyral.archesautomation.workers.dev/api/studio?release=" +
      context.sha,
    { redirect: "error" },
  );
  if (api.status !== 401 || (await api.json()).configured !== true)
    throw Error("Post-deployment private API check failed");
  return {
    deployed: true,
    sha: context.sha,
    deploymentId: result.result?.deployment_id,
  };
}
module.exports = { releaseContext, uploadMetadata, deploy };
if (require.main === module)
  deploy()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
