/**
 * Clip color equalizer — matches FFmpeg `eq` (contrast, brightness,
 * saturation, gamma). Preview uses SVG filters; render uses vf_eq.
 *
 * FFmpeg LUT order (approx): gamma → contrast/brightness; saturation separate.
 * SVG mirrors that: feComponentTransfer(gamma) → linear(contrast/brightness)
 * → feColorMatrix(saturate).
 */

export type CompositionClipEq = {
  /** Default 1. Typical UI range 0–2. */
  contrast?: number
  /** Default 0. Range −1–1. */
  brightness?: number
  /** Default 1. Typical UI range 0–3. */
  saturation?: number
  /** Default 1. Typical UI range 0.1–3. */
  gamma?: number
}

export const DEFAULT_CLIP_EQ: Required<CompositionClipEq> = {
  contrast: 1,
  brightness: 0,
  saturation: 1,
  gamma: 1,
}

export const CLIP_EQ_LIMITS = {
  contrast: { min: 0, max: 2, step: 0.01 },
  brightness: { min: -1, max: 1, step: 0.01 },
  saturation: { min: 0, max: 3, step: 0.01 },
  gamma: { min: 0.1, max: 3, step: 0.01 },
} as const

export function resolveClipEq(
  eq?: CompositionClipEq | null
): Required<CompositionClipEq> {
  return {
    contrast: clampNum(
      eq?.contrast ?? DEFAULT_CLIP_EQ.contrast,
      CLIP_EQ_LIMITS.contrast.min,
      CLIP_EQ_LIMITS.contrast.max
    ),
    brightness: clampNum(
      eq?.brightness ?? DEFAULT_CLIP_EQ.brightness,
      CLIP_EQ_LIMITS.brightness.min,
      CLIP_EQ_LIMITS.brightness.max
    ),
    saturation: clampNum(
      eq?.saturation ?? DEFAULT_CLIP_EQ.saturation,
      CLIP_EQ_LIMITS.saturation.min,
      CLIP_EQ_LIMITS.saturation.max
    ),
    gamma: clampNum(
      eq?.gamma ?? DEFAULT_CLIP_EQ.gamma,
      CLIP_EQ_LIMITS.gamma.min,
      CLIP_EQ_LIMITS.gamma.max
    ),
  }
}

export function isDefaultClipEq(eq?: CompositionClipEq | null): boolean {
  if (!eq) return true
  const r = resolveClipEq(eq)
  return (
    nearly(r.contrast, DEFAULT_CLIP_EQ.contrast) &&
    nearly(r.brightness, DEFAULT_CLIP_EQ.brightness) &&
    nearly(r.saturation, DEFAULT_CLIP_EQ.saturation) &&
    nearly(r.gamma, DEFAULT_CLIP_EQ.gamma)
  )
}

/** Drop default fields; return undefined when everything is default. */
export function compactClipEq(
  eq?: CompositionClipEq | null
): CompositionClipEq | undefined {
  if (!eq || isDefaultClipEq(eq)) return undefined
  const r = resolveClipEq(eq)
  const out: CompositionClipEq = {}
  if (!nearly(r.contrast, DEFAULT_CLIP_EQ.contrast)) out.contrast = r.contrast
  if (!nearly(r.brightness, DEFAULT_CLIP_EQ.brightness))
    out.brightness = r.brightness
  if (!nearly(r.saturation, DEFAULT_CLIP_EQ.saturation))
    out.saturation = r.saturation
  if (!nearly(r.gamma, DEFAULT_CLIP_EQ.gamma)) out.gamma = r.gamma
  return Object.keys(out).length ? out : undefined
}

/** Stable SVG/CSS filter id for a clip. */
export function clipEqFilterId(clipId: string): string {
  return `weave-eq-${clipId.replace(/[^a-zA-Z0-9_-]/g, "_")}`
}

/**
 * SVG transfer params mirroring FFmpeg eq mid-gray contrast + additive brightness:
 * out = contrast * (in - 0.5) + 0.5 + brightness
 *    = contrast * in + (0.5 * (1 - contrast) + brightness)
 */
export function clipEqLinearParams(eq: Required<CompositionClipEq>): {
  slope: number
  intercept: number
  gammaExponent: number
} {
  return {
    slope: eq.contrast,
    intercept: 0.5 * (1 - eq.contrast) + eq.brightness,
    gammaExponent: 1 / Math.max(0.001, eq.gamma),
  }
}

function clampNum(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function nearly(a: number, b: number, eps = 0.0005): boolean {
  return Math.abs(a - b) < eps
}

