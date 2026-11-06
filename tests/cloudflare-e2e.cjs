const fs = require("fs"),
  path = require("path");
const { chromium } = require("playwright");
(async () => {
  const s = {
    qaToken: "local-cloudflare-fixture-token",
    qaPassword: "local-cloudflare-test-password",
  };
  fs.mkdirSync("test-results", { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("BROWSER:", m.text().slice(0, 500));
  });
  try {
    const base = "http://127.0.0.1:3090";
    await page.goto(base + "/#setup=" + s.qaToken);
    await page
      .getByLabel("Studio password", { exact: true })
      .fill(s.qaPassword);
    await page.getByRole("button", { name: "Enter studio" }).click();
    await page
      .getByRole("button", { name: "Create your first brand" })
      .waitFor({ timeout: 30000 });
    console.log("PASS local Cloudflare fixture one-time setup");
    await page.getByRole("button", { name: "Create your first brand" }).click();
    await page.getByLabel("Brand name", { exact: true }).fill("Cloudflare QA");
    await page.getByLabel("Audience", { exact: true }).fill("Test creators");
    await page
      .getByRole("button", { name: "Create brand", exact: true })
      .click();
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAtAAAAQ4CAIAAACv8nweAAAACXBIWXMAAAABAAAAAQBPJcTWAAAQAElEQVR4nO3WUQkAIBTAwJfNNlYxtSmGIAcXYJ+bsxcAQGqeFwAA3zMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHvs6omQAAAg5JREFUAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAADnDAQDkDAcAkDMcAEDOcAAAOcMBAOQMBwCQMxwAQM5wAAA5wwEA5AwHAJAzHABAznAAALkLmvAyXsmGIF0AAAAASUVORK5CYII=",
      "base64",
    );
    await page
      .locator("input[type=file]")
      .setInputFiles({
        name: "source.png",
        mimeType: "image/png",
        buffer: png,
      });
    await page
      .getByRole("heading", { name: "source.png", exact: true })
      .waitFor();
    console.log("PASS local Cloudflare fixture private R2 upload");
    await page
      .getByRole("button", { name: "Use in project", exact: true })
      .click();
    await page.getByLabel("Length (seconds)").fill("2");
    await page.getByLabel("Opening hook").fill("Vyral on Cloudflare");
    await page.getByText("Saved", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Export video", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Download latest video" })
      .waitFor({ timeout: 60000 });
    const href = await page
      .getByRole("link", { name: "Download latest video" })
      .getAttribute("href");
    const authCookie = (await page.context().cookies())
      .map((c) => c.name + "=" + c.value)
      .join("; ");
    const output = await page.request.get(base + href, {
      headers: { Cookie: authCookie },
    });
    if (output.status() !== 200)
      throw Error("Export download " + output.status());
    fs.writeFileSync(
      "test-results/cloud-export." +
        (output.headers()["content-type"].includes("mp4") ? "mp4" : "webm"),
      await output.body(),
    );
    const range = await page.request.get(base + href, {
      headers: { Range: "bytes=0-99", Cookie: authCookie },
    });
    if (range.status() !== 206 || (await range.body()).length !== 100)
      throw Error("Range delivery failed");
    console.log(
      "PASS real Chrome export, authenticated full/range download through R2 adapter",
    );
    if (process.env.FFPROBE_PATH) {
      const { execFileSync } = require("child_process");
      const filename =
        "test-results/cloud-export." +
        (output.headers()["content-type"].includes("mp4") ? "mp4" : "webm");
      const probe = JSON.parse(
        execFileSync(process.env.FFPROBE_PATH, [
          "-v",
          "error",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          filename,
        ]),
      );
      const video = probe.streams.find((s) => s.codec_type === "video");
      if (
        video.width !== 720 ||
        video.height !== 1280 ||
        Math.abs(Number(probe.format.duration) - 2) > 0.3
      )
        throw Error("Export geometry/duration mismatch");
      console.log("PASS FFprobe confirms 720x1280 and 2-second export");
    }
    const state = await (
      await page.request.get(base + "/api/studio", {
        headers: { Cookie: authCookie },
      })
    ).json();
    fs.writeFileSync("test-results/qa-state.json", JSON.stringify(state));
    const p = state.records.project[0];
    const call = async (action, data) => {
      const r = await page.request.post(base + "/api/studio", {
        headers: { Cookie: authCookie },
        data: { action, brandId: p.brandId, ...data },
      });
      const b = await r.json();
      if (!r.ok()) throw Error(JSON.stringify(b));
      return b.result;
    };
    const e = await call("experiment.create", {
      name: "QA hooks",
      projectId: p.id,
      hypothesis: "Opening question helps",
      levels: ["Question?", "Statement."],
    });
    if (!e.id) throw Error("Experiment failed");
    const post = await call("posts.queue", {
      id: p.id,
      scheduledAt: new Date().toISOString(),
    });
    await call("posts.approve", { id: post.id });
    await page.waitForFunction(
      async () => {
        const r = await fetch("/api/studio");
        const s = await r.json();
        return s.records.post.some((p) => p.status === "PUBLISHED");
      },
      {},
      { timeout: 20000 },
    );
    console.log(
      "PASS local Cloudflare fixture variants and durable sandbox alarm",
    );
    await page.reload();
    await page
      .getByRole("heading", { name: /Video Editor|Command Center/ })
      .waitFor();
    await page.screenshot({
      path: "test-results/cloud-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw Error("Mobile overflow");
    await page.screenshot({
      path: "test-results/cloud-mobile.png",
      fullPage: true,
    });
    if (errors.length) throw Error(errors.join("\n"));
    console.log("PASS persisted session, desktop/mobile, no page errors");
  } catch (e) {
    console.error(e);
    console.log((await page.locator("body").innerText()).slice(0, 3000));
    await page.screenshot({
      path: "test-results/cloud-failure.png",
      fullPage: true,
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
