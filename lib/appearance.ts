export type Appearance = {
  mode: "light" | "dark" | "custom";
  contrast: "light" | "dark";
  wallpaper: string;
  dim: number;
  blur: number;
  rim: number;
};
export const APPEARANCE_KEY = "vyral.appearance.v1";
export const defaultAppearance: Appearance = {
  mode: "dark", contrast: "dark", wallpaper: "", dim: 35, blur: 8, rim: 1.3,
};
export function parseAppearance(value: unknown): Appearance {
  const p = value && typeof value === "object" ? value as Partial<Appearance> : {};
  const range = (n: unknown, fallback: number, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  return {
    mode: p.mode === "light" || p.mode === "custom" ? p.mode : "dark",
    contrast: p.contrast === "light" ? "light" : "dark",
    wallpaper: typeof p.wallpaper === "string" && p.wallpaper.length < 2_000_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.wallpaper) ? p.wallpaper : "",
    dim: range(p.dim, 35, 0, 80), blur: range(p.blur, 8, 0, 24), rim: range(p.rim, 1.3, 0.5, 2),
  };
}
