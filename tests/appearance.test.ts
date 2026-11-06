import test from "node:test";
import assert from "node:assert/strict";
import { parseAppearance, defaultAppearance } from "../lib/appearance.ts";

test("invalid or old appearance data safely returns readable defaults", () => {
  for (const value of [null, undefined, "bad", {}, { mode: "unknown", blur: NaN, rim: Infinity }]) {
    assert.deepEqual(parseAppearance(value), defaultAppearance);
  }
});
test("appearance ranges are bounded and custom image schemes are restricted", () => {
  const value = parseAppearance({ mode: "custom", contrast: "light", blur: 999, rim: -4, dim: 100, wallpaper: "javascript:alert(1)" });
  assert.deepEqual(value, { mode: "custom", contrast: "light", blur: 24, rim: 0.5, dim: 80, wallpaper: "" });
  assert.equal(parseAppearance({ wallpaper: "data:image/svg+xml;base64,AAAA" }).wallpaper, "");
  assert.equal(parseAppearance({ wallpaper: "https://tracking.example/a.jpg" }).wallpaper, "");
  assert.equal(parseAppearance({ wallpaper: "data:image/jpeg;base64,AAAA" }).wallpaper, "data:image/jpeg;base64,AAAA");
  assert.equal(parseAppearance({ wallpaper: "data:image/jpeg;base64," + "a".repeat(2_000_000) }).wallpaper, "");
});
