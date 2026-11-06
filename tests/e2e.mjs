import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.stack || e.message));
try {
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:3000");
  await page
    .getByLabel("Studio password")
    .fill(process.env.TEST_PASSWORD || "vyral-e2e-test-password");
  await page.getByRole("button", { name: "Enter studio" }).click();
  await page.getByRole("heading", { name: /Command Center/ }).waitFor();
  if (
    await page.getByRole("button", { name: "Create your first brand" }).count()
  )
    await page.getByRole("button", { name: "Create your first brand" }).click();
  else await page.getByLabel("Brand workspace").selectOption("new");
  await page
    .getByLabel("Brand name", { exact: true })
    .fill("QA Creative Brand");
  await page.getByLabel("Audience", { exact: true }).fill("Curious creators");
  await page.getByRole("button", { name: "Create brand", exact: true }).click();
  await page.getByRole("heading", { name: "Command Center." }).waitFor();
  if (process.env.TEST_MEDIA) {
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await page
      .locator("input[type=file]")
      .setInputFiles(process.env.TEST_MEDIA);
    await page
      .getByRole("heading", { name: "source.png", exact: true })
      .waitFor();
  }
  await page.getByRole("button", { name: "Inspiration", exact: true }).click();
  await page
    .getByRole("button", { name: "Save inspiration", exact: true })
    .click();
  await page.getByLabel("Reference title").fill("Mountain travel opening");
  await page.getByLabel("Original link").fill("https://example.com/original");
  await page
    .getByLabel("Creative observations")
    .fill("Open with a question. Slow cuts, warm light, quiet music.");
  await page
    .getByRole("button", { name: "Save reference", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Mountain travel opening" })
    .waitFor();
  await page.getByRole("button", { name: "Inspect DNA" }).click();
  await page
    .getByRole("heading", { name: "Creative DNA", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Adapt idea" }).click();
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("button", { name: "Open editor" }).click();
  if (process.env.TEST_MEDIA) {
    await page.getByRole("button", { name: /source.png image/ }).click();
    await page.getByLabel("Length (seconds)").fill("2");
  }
  await page
    .getByLabel("Opening hook")
    .fill("What if your next idea starts here?");
  await page.getByText("Saved", { exact: true }).waitFor();
  if (process.env.TEST_MEDIA) {
    await page.getByRole("button", { name: "Render MP4", exact: true }).click();
    await page
      .getByRole("link", { name: "Download latest MP4" })
      .waitFor({ timeout: 120000 });
    const href = await page
      .getByRole("link", { name: "Download latest MP4" })
      .getAttribute("href");
    const download = await page.request.get(new URL(href, page.url()).href);
    assert.equal(download.status(), 200);
    assert.equal(download.headers()["content-type"], "video/mp4");
    const partial = await page.request.get(new URL(href, page.url()).href, {
      headers: { Range: "bytes=0-99" },
    });
    assert.equal(partial.status(), 206);
    assert.equal((await partial.body()).length, 100);
  }
  await page
    .getByRole("button", { name: "Create experiment", exact: true })
    .click();
  await page.getByLabel("Experiment name").fill("Question vs statement");
  await page
    .getByLabel("Hypothesis")
    .fill("A question opening improves retained plays.");
  await page
    .getByLabel("Variant levels")
    .fill("What if your next idea starts here?\nYour next idea starts here.");
  await page
    .getByRole("button", { name: "Create variants", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Question vs statement", exact: true })
    .waitFor();
  if (process.env.TEST_MEDIA) {
    await page
      .getByRole("button", { name: "Render", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Schedule", exact: true })
      .first()
      .waitFor({ timeout: 120000 });
    await page
      .getByRole("button", { name: "Schedule", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Publish at")
      .fill(
        new Date(Date.now() - 60000 - new Date().getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16),
      );
    await page.getByRole("button", { name: "Add to approval queue" }).click();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page
      .getByRole("cell", { name: "PUBLISHED", exact: true })
      .waitFor({ timeout: 30000 });
    await page
      .getByRole("button", { name: /Experiment Lab/ })
      .click();
  }
  await page
    .getByRole("button", { name: "Measure", exact: true })
    .first()
    .click();
  await page.getByLabel("Plays retained").fill("120");
  await page.getByLabel("Total eligible plays").fill("200");
  await page.getByLabel("Data source").selectOption("true");
  await page.getByRole("button", { name: "Save measurement" }).click();
  await page.getByText("60.0%", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await page.getByRole("cell", { name: "SYNTHETIC", exact: true }).waitFor();
  assert.ok((await page.getByText("Synthetic test plays").count()) > 0);
  for (const name of [
    "Command Center",
    "Content Lab",
    "AI Generation",
    "Publishing",
    "Creative Intelligence",
    "Assets",
    "Settings",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.locator("h1").waitFor();
  }
  await page
    .getByRole("button", { name: "Command Center", exact: true })
    .click();
  await page.screenshot({
    path: process.env.SCREENSHOT_PATH || "test-results/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelector(".sidebar").getBoundingClientRect().right <= 1,
  );
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  assert.equal(overflow, false, "Mobile layout must not overflow");
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser journey: login → brand → inspiration → project → editor autosave → A/B variants → synthetic metrics → analytics. Desktop/mobile layout and all navigation checked. Optional TEST_MEDIA additionally verifies upload, actual MP4/variant rendering, authenticated range download, scheduling, approval, and worker sandbox publishing.",
  );
} finally {
  await browser.close();
}
