---
inclusion: always
---

# Steering 02 — Self-Hosted FFmpeg.wasm Bundling (Zero External CDNs)

## Context
Many `@ffmpeg/ffmpeg` examples load `ffmpeg-core.js` and `ffmpeg-core.wasm` from `unpkg.com` or `jsdelivr.net` at runtime. Under `Cross-Origin-Embedder-Policy: require-corp`, offline networks, or strict enterprise/judge firewalls, external CDN fetches fail and brick video forging.

## Mandatory Rules
1. **Same-Origin Static Core Assets**:
   - `src/ffmpeg/forger.ts` **must** keep `FFMPEG_CORE_JS_URL = '/ffmpeg/ffmpeg-core.js'` and `FFMPEG_CORE_WASM_URL = '/ffmpeg/ffmpeg-core.wasm'`, backed by committed binaries in `public/ffmpeg/ffmpeg-core.js` and `public/ffmpeg/ffmpeg-core.wasm`.
   - Regression test `uses strictly local same-origin paths for FFmpeg core assets (zero external CDN)` in `tests/hardening.test.ts` must always pass.
2. **Vite Dependency Optimization Exclusions**:
   - Keep `['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core']` in `optimizeDeps.exclude` inside `vite.config.ts` so Vite's esbuild pre-bundler never rewrites internal Web Worker `new URL(..., import.meta.url)` references.
3. **Blob URL Bootstrapping Cleanup**:
   - Load core scripts via `toBlobURL(FFMPEG_CORE_JS_URL, 'text/javascript')` and `toBlobURL(FFMPEG_CORE_WASM_URL, 'application/wasm')`. If `ffmpeg.load()` rejects, immediately call `URL.revokeObjectURL` on both blob URLs and reset `loadPromise = null` so subsequent retries can recover cleanly.
