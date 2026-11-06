# Video editor

The version-1 composition is the source of truth: width, height, fps, duration, source clip IDs, source in points, timeline ranges, audio volume, color EQ, and timed text overlays. Every save produces a revision. Variants retain their source revision and separate compositions.

Working controls: clip import from library, scrubbing, muted playback, source trim, timing, split at playhead, draggable stacking order, volume, opening text, format/duration, undo/redo, autosave, and color presets. Native rendering includes original source audio and explicit audio tracks. Higher clip order overlays earlier clips; start/end timing controls when each appears. Drag order changes stacking order, not automatic sequential timing.

Rendering runs in the background, uses local UUID asset paths, calls FFmpeg without a shell, crops to the target format, overlays text using UTF-8 files, mixes audio, and writes H.264/AAC MP4 with faststart. FFprobe verifies output geometry and duration. Source duration checks reject over-trims. Download is authenticated.

The native real-media test generates a blue clip and sine wave in FFmpeg, renders a hook, then verifies 720×1080 output, two-second duration, and audio presence. Test media is generated in a temporary directory, not bundled third-party footage.

Limitations: preview is muted and approximates FFmpeg color through CSS. No keyframe animation, speed controls, captions/transcription, crossfades, transitions, zoom/reframe controls, or AI edit requests. Source clips must be trimmed within their real lengths; user uploads do not yet auto-populate duration. Text preview scale is approximate; very long hooks can exceed native render safe areas. Shot-segmentation variants split continuous footage and do not change source scene selection.

Weave’s MIT color EQ helpers are actually reused. Timeline/renderer are Vyral implementations guided by the reviewed composition architecture; the full Weave editor is not embedded, and no ffmpeg.wasm/GPL bundle is loaded.
