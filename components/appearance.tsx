"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { APPEARANCE_KEY, defaultAppearance, parseAppearance, type Appearance } from "../lib/appearance";
import { createLiquidGlass, supportsRefraction } from "../vendor/nordify/liquid-glass";

const AppearanceContext = createContext({
  value: defaultAppearance,
  change: (_patch: Partial<Appearance>) => {},
  message: "",
});

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState(defaultAppearance);
  const current = useRef(defaultAppearance);
  const [message, setMessage] = useState("");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(APPEARANCE_KEY);
      current.current = saved ? parseAppearance(JSON.parse(saved)) : defaultAppearance;
      setValue(current.current);
    } catch { setMessage("Settings could not be read. You can still customize this session."); }
  }, []);
  const tone = value.mode === "custom" ? value.contrast : value.mode;
  useEffect(() => {
    document.documentElement.dataset.theme = tone;
    document.documentElement.dataset.background = value.mode;
    return () => {
      delete document.documentElement.dataset.theme;
      delete document.documentElement.dataset.background;
    };
  }, [tone, value.mode]);
  function change(patch: Partial<Appearance>) {
    const next = parseAppearance({ ...current.current, ...patch });
    current.current = next;
    setValue(next);
    try {
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
      setMessage("Appearance saved on this device.");
    } catch { setMessage("Storage is full or unavailable. Changes apply for this session only."); }
  }
  return <AppearanceContext.Provider value={{ value, change, message }}>
    <div className="studio-wallpaper" aria-hidden="true" style={{
      backgroundImage: value.mode === "custom" && value.wallpaper ? `url("${value.wallpaper}")` : undefined,
    }} />
    {value.mode === "custom" && <div className="wallpaper-shade" aria-hidden="true" style={{ background: `rgb(${tone === "dark" ? "0 0 0" : "255 255 255"} / ${value.dim / 100})` }} />}
    {children}
  </AppearanceContext.Provider>;
}

/** A dedicated DOM island keeps the imperative SVG layers out of React's content. */
export function GlassBackdrop({ reflect = false, radius = 22 }: { reflect?: boolean; radius?: number }) {
  const { value } = useContext(AppearanceContext);
  const ref = useRef<HTMLSpanElement>(null);
  const tone = value.mode === "custom" ? value.contrast : value.mode;
  useEffect(() => {
    if (!ref.current) return;
    const lens = createLiquidGlass(ref.current, { radius, blur: value.blur, rim: value.rim, reflect, promote: false });
    return () => lens.destroy();
  }, [radius, value.blur, value.rim, reflect]);
  return <span className="glass-slot" aria-hidden="true"><span className="glass-backdrop" ref={ref} data-lg-dark={tone === "dark" ? "" : undefined} /></span>;
}

export function AppearanceSettings() {
  const { value, change, message } = useContext(AppearanceContext);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [refraction, setRefraction] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; setRefraction(supportsRefraction); return () => { mounted.current = false; }; }, []);
  async function upload(file?: File) {
    if (!file) return;
    setUploadError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setUploadError("Choose a JPG, PNG, or WebP image under 10 MB."); return;
    }
    setUploading(true);
    let url = "";
    try {
      url = URL.createObjectURL(file);
      const image = new Image(); image.src = url; await image.decode();
      if (image.width * image.height > 60_000_000) throw Error("Choose an image smaller than 60 megapixels.");
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d"); if (!ctx) throw Error("Image processing is unavailable in this browser.");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const wallpaper = canvas.toDataURL("image/jpeg", 0.82);
      if (wallpaper.length >= 2_000_000) throw Error("This image is too detailed to save. Try a smaller image.");
      if (mounted.current) change({ wallpaper, mode: "custom" });
    } catch (e) { if (mounted.current) setUploadError(e instanceof Error ? e.message : "This image could not be opened."); }
    finally { if (url) URL.revokeObjectURL(url); if (mounted.current) setUploading(false); }
  }
  return <section className="panel appearance-panel">
    <GlassBackdrop />
    <div className="panel-head"><div><span className="eyebrow">MAKE IT YOURS</span><h3>Wallpaper & glass</h3></div><span className="badge">Nordify glass</span></div>
    <p className="muted">Choose the light, set the backdrop, and make room for your ideas.</p>
    <div className="appearance-modes" role="group" aria-label="Appearance mode">
      {(["light", "dark", "custom"] as const).map(mode => <button key={mode} className={`mode-card ${value.mode === mode ? "selected" : ""}`} aria-pressed={value.mode === mode} onClick={() => change({ mode })}>
        <span className={`mode-swatch ${mode}`} aria-hidden="true"><i /><i /><i /></span>
        <strong>{mode === "custom" ? "Custom background" : mode === "light" ? "Light" : "Dark"}</strong>
        <small>{mode === "light" ? "Bright & airy" : mode === "dark" ? "Quiet & focused" : "Your own atmosphere"}</small>
      </button>)}
    </div>
    {value.mode === "custom" && <div className="wallpaper-controls">
      <label>Your background<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
      <small className="muted">{uploading ? "Preparing your background…" : "JPG, PNG, or WebP · up to 10 MB. Saved only on this device."}</small>
      {value.wallpaper && <button className="text-btn" onClick={() => change({ wallpaper: "" })}>Remove image</button>}
      <label>Text & panel contrast<select value={value.contrast} onChange={e => change({ contrast: e.target.value as "light" | "dark" })}><option value="dark">Dark</option><option value="light">Light</option></select></label>
      <label>Background overlay <span className="range-value">{value.dim}%</span><input aria-label="Background overlay" type="range" min="0" max="80" value={value.dim} onChange={e => change({ dim: Number(e.target.value) })} /></label>
    </div>}
    <div className="glass-sliders">
      <label>Frost <span className="range-value">{value.blur} px</span><input aria-label="Frost" type="range" min="0" max="24" value={value.blur} onChange={e => change({ blur: Number(e.target.value) })} /></label>
      <label>Refraction rim <span className="range-value">{value.rim.toFixed(1)}</span><input aria-label="Refraction rim" type="range" min="0.5" max="2" step="0.1" value={value.rim} onChange={e => change({ rim: Number(e.target.value) })} /></label>
    </div>
    <div className="appearance-preview"><div className="preview-lettering" aria-hidden="true">Create.<br />Something.<br />Yours.</div><div className="preview-glass"><GlassBackdrop reflect radius={30} /><div><span className="eyebrow">LIVE PREVIEW</span><h3>A little clarity.</h3><p>Your next idea looks good here.</p></div></div></div>
    <p className="appearance-support muted">{refraction ? "Live refraction and reflection are active." : "Frosted glass is active. Full refraction is available in Chrome, Edge, and other Chromium browsers."}</p>
    {uploadError && <p role="alert" className="error">{uploadError}</p>}
    <div className="appearance-footer"><span role="status">{message}</span><button className="text-btn" onClick={() => { setUploadError(""); change(defaultAppearance); }}>Reset appearance</button></div>
  </section>;
}
