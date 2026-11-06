# Nordify liquid glass

Source: https://github.com/nordify/css-liquid-glass
Pinned commit: 1eae0ba146dc48b30caf90f993a118b2915519cf
License: MIT; original notice retained in LICENSE.

maps.ts and liquid-glass.css are unmodified. liquid-glass.ts only removes the CSS import because Vyral loads the stylesheet globally in both the Next layout and its Cloudflare asset builder. GlassBackdrop owns mounting and cleanup in React. Avoid backdrop roots (opacity, filter, isolation, overflow clipping, or transforms) on glass hosts and their ancestors. Content is kept outside the imperative DOM island. Reflection is reserved for the header and appearance preview to bound GPU work; panels use refraction only. Mobile navigation uses frosted CSS rather than a lens inside its transformed drawer.

Chromium supports the full effect. Safari, Firefox, and iOS receive the upstream frosted fallback.
