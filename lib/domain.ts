export type Kind =
  | "brand"
  | "inspiration"
  | "project"
  | "asset"
  | "experiment"
  | "variant"
  | "post"
  | "snapshot"
  | "job"
  | "audit";
export interface Row {
  id: string;
  brandId: string;
  kind: Kind;
  name: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
export interface Clip {
  id: string;
  assetId: string;
  kind: "video" | "image" | "audio";
  start: number;
  end: number;
  in: number;
  volume: number;
  eq?: {
    contrast?: number;
    brightness?: number;
    saturation?: number;
    gamma?: number;
  };
}
export interface Overlay {
  id: string;
  text: string;
  start: number;
  end: number;
  y: number;
  fontSize: number;
  color: string;
}
export interface Composition {
  version: 1;
  width: number;
  height: number;
  fps: number;
  duration: number;
  clips: Clip[];
  overlays: Overlay[];
}
export const emptyComposition = (): Composition => ({
  version: 1,
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 10,
  clips: [],
  overlays: [],
});
export function validateComposition(c: Composition) {
  if (
    !c ||
    c.version !== 1 ||
    ![1080, 720].includes(c.width) ||
    ![1920, 1080, 720].includes(c.height) ||
    !Number.isFinite(c.duration) ||
    c.duration < 1 ||
    c.duration > 180 ||
    c.fps !== 30 ||
    !Array.isArray(c.clips) ||
    !Array.isArray(c.overlays) ||
    c.clips.length > 100 ||
    c.overlays.length > 100
  )
    throw Error("Invalid composition");
  for (const x of [...c.clips, ...c.overlays])
    if (
      !Number.isFinite(x.start) ||
      !Number.isFinite(x.end) ||
      x.start < 0 ||
      x.end <= x.start ||
      x.end > c.duration
    )
      throw Error("Invalid clip timing");
  if (
    new Set(c.clips.map((x) => x.id)).size !== c.clips.length ||
    new Set(c.overlays.map((x) => x.id)).size !== c.overlays.length
  )
    throw Error("Duplicate composition IDs");
  for (const x of c.clips)
    if (
      typeof x.assetId !== "string" ||
      !["video", "audio", "image"].includes(x.kind) ||
      !Number.isFinite(x.in) ||
      x.in < 0 ||
      !Number.isFinite(x.volume) ||
      x.volume < 0 ||
      x.volume > 2
    )
      throw Error("Invalid source settings");
  for (const x of c.overlays)
    if (
      typeof x.text !== "string" ||
      x.text.length > 300 ||
      !Number.isFinite(x.y) ||
      x.y < 0 ||
      x.y > 1 ||
      !Number.isFinite(x.fontSize) ||
      x.fontSize < 12 ||
      x.fontSize > 120 ||
      !/^#[0-9a-f]{6}$/i.test(x.color)
    )
      throw Error("Invalid overlay");
  return c;
}
export function variants(
  base: Composition,
  axis: "hook" | "pacing",
  levels: string[],
) {
  validateComposition(base);
  if (
    levels.length < 2 ||
    levels.length > 26 ||
    levels.some((x) => !x.trim() || x.length > 300) ||
    new Set(levels).size !== levels.length
  )
    throw Error("Provide 2–26 unique levels");
  return levels.map((value, i) => {
    const c = structuredClone(base);
    if (axis === "hook") {
      c.overlays = c.overlays.filter((x) => x.id !== "hook");
      c.overlays.push({
        id: "hook",
        text: value,
        start: 0,
        end: Math.min(3, c.duration),
        y: 0.35,
        fontSize: 56,
        color: "#ffffff",
      });
    } else {
      const pace = Number(value);
      if (!Number.isFinite(pace) || pace < 0.3 || pace > 10)
        throw Error("Pacing must be 0.3–10 seconds");
      c.clips = c.clips.flatMap((clip) => {
        if (clip.kind === "audio") return [clip];
        const out: Clip[] = [];
        for (let t = clip.start; t < clip.end; t += pace)
          out.push({
            ...clip,
            id: `${clip.id}-${out.length}`,
            start: t,
            end: Math.min(t + pace, clip.end),
            in: clip.in + t - clip.start,
          });
        return out;
      });
    }
    return {
      label: String.fromCharCode(65 + i),
      assignments: { [axis]: value },
      changes: { axis, value },
      composition: validateComposition(c),
    };
  });
}
export function factorial(
  factors: Record<string, string[]>,
  limit = 26,
): Record<string, string>[] {
  let out: Record<string, string>[] = [{}];
  for (const [key, values] of Object.entries(factors)) {
    if (!values.length) throw Error("Empty factor");
    if (out.length * values.length > limit)
      throw Error("Design exceeds 26 variants; stage this experiment");
    out = out.flatMap((a) => values.map((v) => ({ ...a, [key]: v })));
  }
  return out;
}
export function wilson(success: number, total: number, z = 1.96) {
  if (
    !Number.isInteger(total) ||
    !Number.isInteger(success) ||
    total <= 0 ||
    success < 0 ||
    success > total
  )
    throw Error("Invalid binary observations");
  const p = success / total,
    d = 1 + (z * z) / total,
    center = (p + (z * z) / (2 * total)) / d,
    half =
      (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) /
      d;
  return {
    rate: p,
    low: Math.max(0, center - half),
    high: Math.min(1, center + half),
  };
}
export function compare(
  rows: {
    label: string;
    success?: number;
    total?: number;
    windowHours?: number;
    synthetic?: boolean;
  }[],
  min = 100,
  window = 24,
) {
  // Conservative Bonferroni simultaneous intervals. 3.5 covers up to 26 levels at family alpha <= .05.
  const measured = rows
    .filter(
      (r) => r.success !== undefined && r.total !== undefined && r.total > 0,
    )
    .map((r) => ({
      ...r,
      ...wilson(r.success!, r.total!, rows.length > 2 ? 3.5 : 2.24),
    }))
    .sort((a, b) => b.rate - a.rate);
  const sameSource = rows.every((r) => !!r.synthetic === !!rows[0]?.synthetic);
  const eligible =
    sameSource &&
    measured.length === rows.length &&
    rows.length >= 2 &&
    measured.every((r) => r.total! >= min && r.windowHours === window);
  const lead = measured[0];
  const separated =
    eligible && lead && measured.slice(1).every((r) => lead.low > r.high);
  return {
    status: !eligible
      ? "Insufficient comparable exposure"
      : separated
        ? "Supported association"
        : "Inconclusive",
    leading: lead?.label,
    rows: measured,
    synthetic: rows.some((r) => r.synthetic),
    note: "Organic distribution is observational. Intervals are exploratory and assume binary observations; repeated views may be dependent. No causal claim.",
  };
}
export function creativeDNA(notes: string) {
  const words = notes.trim().split(/\s+/).length;
  return {
    schema_version: 1,
    source: "user_notes",
    confidence: "manual",
    pacing: {
      avg_shot_duration_sec: 2,
      cut_style: "hard_cut",
      beat_synced: false,
    },
    text_overlays: { style: "bold_center", position: "center" },
    hook: notes.slice(0, 300),
    word_count: words,
    limitations: [
      "Notes-based template; no video analysis or OCR has been performed.",
    ],
  };
}
