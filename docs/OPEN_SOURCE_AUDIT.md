# Open-source audit

Inspected November 6, 2026 through connected GitHub source access. Pins are immutable commit IDs. README claims are separated from locally tested Vyral behavior.

| Repository | Pin | License | Decision and actual reuse |
| --- | --- | --- | --- |
| [Open Higgsfield](https://github.com/joymadhu49/open-higgsfield) | `6be3b7eeffff0c4282faada8ea4995d1c2874c0a` | MIT, notice retained | **Adapt.** Actual copied `src/shared/models.ts`, `src/shared/types.ts`, `src/server/payloads.ts` under `vendor/open-higgsfield/`. Payload import paths changed only. Existing no-login application is not exposed or embedded. |
| [EditDNA/easy-edit](https://github.com/MEX-creator/easy-edit) | `8591e4f9ba88894b2a78e4c0d47d47bd4a53c818` | MIT per upstream | **Reference now; analyzer integration later.** Reviewed README, tree, and `core/template.py`. No source copied. Vyral notes-based schema is explicitly manual; no shot/OCR/beat analysis claimed. |
| [Weave](https://github.com/thiagoalbrecht/weave) | `e7ca830d570c426708b82a05b9e2ed00fc5bb3c1` | MIT source; upstream demo warns about GPL wasm FFmpeg | **Adapt selectively.** Actual `src/composition/eq.ts` copied under `vendor/weave/` with original MIT notice. Reviewed composition translator source and model architecture. Vyral renderer uses native FFmpeg; no wasm binary or full editor app copied. |
| [Hook Tester](https://github.com/jameselle/hook-tester) | `2747b625b91a0d45f0120fe80d907fe517909b49` | MIT per upstream | **Reference only.** Reviewed README and measurement/Trial Reel approach. No code copied or Meta claims treated as independently verified. Vyral uses its own conservative statistical engine and sandbox provider. |
| [Trialr](https://github.com/justynberk/trialr) | Unavailable | Unverified | **Blocked/reference deferred.** GitHub returned 404 for repository content. No code copied, no license inferred, no integration claimed. |
| [ClippyMe](https://github.com/fralapo/clippyme) | `00b2f3a9d2b0cca8a77e7a51bc002f026d46d7ce` | MIT per README | **Reference only.** Reviewed pipeline/features/security boundaries. No code copied. Transcription, active-speaker framing, and Zernio integration are not implemented. |
| [Postiz](https://github.com/gitroomhq/postiz-app) | `5a131eb01d91eeeb53c76ba6f76a068e89f8ee18` | AGPL-3.0, LICENSE inspected | **Do not embed.** No code copied or service connected. A separately deployed integration can be evaluated later with its obligations. |

## Tests and integration complexity

Open Higgsfield pure model/payload helpers are exercised in local unit tests for frame shape, duration/resolution behavior, aspect omission, audio flags, and estimated cost. Actual provider endpoint invocation is mocked; no paid/live generation was performed. Catalog verified flags are upstream data, not new Vyral certifications. This source is young; API drift and output URL authorization remain integration risks.

Weave EQ normalization is called by Vyral's native renderer and tested for range/NaN handling. Color preview is approximate CSS, not the complete upstream SVG/FFmpeg parity system. The complete Weave editor and its graph translator were not adopted; Vyral owns its smaller timeline implementation. Advanced transitions and effects remain missing rather than being presented as inherited features.

EditDNA’s Python/FFmpeg/OpenCV/OCR/audio dependencies require a separate analyzed-media worker and confidence-aware UI. Keeping its core analysis independent of Resolve is feasible but not executed in this slice. A manual template is not a substitute for deterministic source analysis.

Live social integrations require current official API verification, app registration, user authorization, quotas, and mock tests; reviewed READMEs cannot establish current eligibility. Trialr's inaccessible source cannot be evaluated. ClippyMe and Postiz would duplicate substantial pipeline/scheduler infrastructure and introduce different dependencies; they remain references.

## Notices and distribution

Original MIT text is retained in each adopted vendor directory. No Postiz source, upstream brand logos, demo footage, or GPL wasm encoder is included. Native FFmpeg is an external system dependency whose license depends on the installed build; Docker's distro FFmpeg/libx264 includes GPL components. Review and provide applicable notices/source obligations when distributing that container or encoder binary. MIT source reuse does not remove independent obligations of distributed system software. The root application has no newly asserted open-source license; the repository owner can choose its distribution terms.
