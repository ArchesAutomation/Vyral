import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyComposition,
  validateComposition,
  variants,
  factorial,
  wilson,
  compare,
  creativeDNA,
} from "../lib/domain.ts";
import {
  VIDEO_MODELS,
  IMAGE_MODELS,
  estimateVideoCost,
} from "../vendor/open-higgsfield/models.ts";
import {
  buildVideoPayload,
  buildImagePayload,
} from "../vendor/open-higgsfield/payloads.ts";
import { resolveClipEq } from "../vendor/weave/eq.ts";
test("valid compositions and invalid timing", () => {
  const c = emptyComposition();
  assert.equal(validateComposition(c), c);
  assert.throws(
    () =>
      validateComposition({
        ...c,
        overlays: [
          {
            id: "x",
            text: "hello",
            start: 4,
            end: 2,
            y: 0.5,
            fontSize: 50,
            color: "#ffffff",
          },
        ],
      }),
    /timing/,
  );
  assert.throws(() => validateComposition({ ...c, duration: Infinity }));
});
test("hook variations preserve base and isolate the hook", () => {
  const c = emptyComposition(),
    before = JSON.stringify(c),
    out = variants(c, "hook", ["Question?", "A promise.", "A story."]);
  assert.equal(JSON.stringify(c), before);
  assert.equal(out.length, 3);
  assert.deepEqual(
    out.map((v) => v.label),
    ["A", "B", "C"],
  );
  assert.equal(out[1].composition.overlays[0].text, "A promise.");
  assert.equal(out[1].composition.duration, c.duration);
  assert.throws(() => variants(c, "hook", ["same", "same"]));
});
test("pacing segmentation preserves source ranges", () => {
  const c = emptyComposition();
  c.clips = [
    {
      id: "v",
      assetId: "a",
      kind: "video",
      start: 0,
      end: 8,
      in: 2,
      volume: 1,
    },
  ];
  const out = variants(c, "pacing", ["2", "4"]);
  assert.equal(out[0].composition.clips.length, 4);
  assert.equal(out[0].composition.clips[3].in, 8);
  assert.equal(out[1].composition.clips.length, 2);
  assert.throws(() => variants(c, "pacing", ["NaN", "2"]));
});
test("factorial designs preflight the combination count", () => {
  assert.equal(
    factorial({ hook: ["a", "b", "c"], pace: ["fast", "slow"] }).length,
    6,
  );
  assert.throws(
    () => factorial({ a: Array(6).fill("a"), b: Array(5).fill("b") }),
    /exceeds/,
  );
});
test("Wilson intervals match known 50/100 example", () => {
  const r = wilson(50, 100);
  assert.ok(Math.abs(r.low - 0.4038) < 0.001);
  assert.ok(Math.abs(r.high - 0.5962) < 0.001);
  assert.throws(() => wilson(101, 100));
  assert.throws(() => wilson(1, 0));
});
test("comparison requires exposure and equivalent windows", () => {
  assert.equal(
    compare([
      { label: "A", success: 9, total: 10, windowHours: 24 },
      { label: "B", success: 3, total: 10, windowHours: 24 },
    ]).status,
    "Insufficient comparable exposure",
  );
  assert.equal(
    compare([
      { label: "A", success: 900, total: 1000, windowHours: 24 },
      { label: "B", success: 400, total: 1000, windowHours: 48 },
    ]).status,
    "Insufficient comparable exposure",
  );
});
test("comparison separates strong associations and rejects ties", () => {
  assert.equal(
    compare([
      { label: "A", success: 900, total: 1000, windowHours: 24 },
      { label: "B", success: 300, total: 1000, windowHours: 24 },
    ]).status,
    "Supported association",
  );
  assert.equal(
    compare([
      { label: "A", success: 500, total: 1000, windowHours: 24 },
      { label: "B", success: 510, total: 1000, windowHours: 24 },
    ]).status,
    "Inconclusive",
  );
});
test("synthetic and real observations cannot be combined", () => {
  assert.equal(
    compare([
      {
        label: "A",
        success: 900,
        total: 1000,
        windowHours: 24,
        synthetic: true,
      },
      {
        label: "B",
        success: 300,
        total: 1000,
        windowHours: 24,
        synthetic: false,
      },
    ]).status,
    "Insufficient comparable exposure",
  );
});
test("Creative DNA never labels notes as machine analysis", () => {
  const r = creativeDNA("Fast travel reel with a question");
  assert.equal(r.source, "user_notes");
  assert.equal(r.confidence, "manual");
  assert.ok(r.limitations[0].includes("no video analysis"));
});
test("Open Higgsfield payloads enforce provider-specific formats", () => {
  const m = VIDEO_MODELS.find((m) => m.omitAspectRatioOnI2v)!;
  const r = buildVideoPayload(
    m,
    { prompt: "test", duration: 5, aspectRatio: "9:16", audio: false },
    { firstFrame: "data:image/png;base64,AAA" },
  );
  assert.equal(r.body.aspect_ratio, undefined);
  assert.equal(r.body.frame_images?.[0].frame_type, "first_frame");
  const silent = VIDEO_MODELS.find((m) => !m.caps.audio)!;
  assert.equal(
    buildVideoPayload(silent, { prompt: "test", duration: 5, audio: true }, {})
      .body.generate_audio,
    undefined,
  );
  assert.ok(estimateVideoCost(m, 5, "720p")! > 0);
  const img = IMAGE_MODELS[0];
  assert.equal(
    buildImagePayload(img, { prompt: "p", aspectRatio: "9:16", size: "1K" }, [])
      .endpoint,
    "chat",
  );
});
test("Weave color helpers clamp invalid inputs", () => {
  assert.equal(resolveClipEq({ saturation: 99 }).saturation, 3);
  assert.equal(resolveClipEq({ contrast: NaN }).contrast, 0);
});
