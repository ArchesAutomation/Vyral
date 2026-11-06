# Wallpaper and liquid glass

Open Settings or the Appearance shortcut in the header. Appearance also works before creating a brand.

- Light and dark modes tune both the page and Nordify glass lighting.
- Custom mode accepts JPG, PNG, and WebP images up to 10 MB, resizes them to at most 1600 pixels, and stores the compressed image on the current device. No upload to Vyral's media service or external host occurs.
- Custom backgrounds have an independent light/dark contrast selector and a 0–80% overlay.
- Frost (0–24 px) and refraction rim (0.5–2.0) update the live preview, header, and mounted panels. Reflection is reserved for the header and preview to limit GPU work. Sidebar and summary cards use tinted translucent surfaces.
- Settings survive reloads in versioned localStorage. Corrupt settings fall back safely; blocked/full storage reports session-only changes. Reset clears the custom wallpaper and restores dark defaults.
- Full SVG backdrop refraction is supported in Chromium. Safari, Firefox, and iOS use Nordify's frosted fallback. This is a browser limitation rather than a second rendering engine.

The upstream engine is pinned with its MIT license under vendor/nordify. Its CSS is included in both Next.js and the Cloudflare asset builder; do not add a runtime CSS require to the Cloudflare client.

## Verification

Local verification: typecheck, Next production build, Cloudflare bundle build, and 24 passing unit/integration/release tests. One existing native FFmpeg test is skipped when its tools are unavailable. Browser checks covered light/dark/custom controls, wallpaper file selection and successful decoding, and a 390-pixel mobile layout. No paid generation or live social posting was performed.

Reviewer checks: switch all three modes, upload a detailed wallpaper, adjust frost/rim/overlay, choose both custom contrast settings, reload, then reset. Navigate through editor, generation, dialogs, and asset views in light mode. Compare the effect in desktop Chromium and the frosted fallback in Safari/Firefox on real displays; those fallback browsers were not available in this session. Appearance is device-local, not synchronized between accounts/devices.

Release follows the existing reviewed-main GitHub workflow. This change does not deploy a local or unmerged build. The existing GitHub Actions CLOUDFLARE_API_TOKEN setup remains required for automatic deployment.
