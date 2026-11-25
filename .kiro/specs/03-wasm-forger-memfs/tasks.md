# Spec 03 — Self-Hosted FFmpeg.wasm Forger & MEMFS Hygiene (`tasks.md`)

## Implementation & Verification Checklist

- [x] **Task 3.1 — Vendor Self-Hosted FFmpeg Core Assets (`public/ffmpeg/`)**
  - Copy `ffmpeg-core.js` and `ffmpeg-core.wasm` into `public/ffmpeg/` and exclude `public/ffmpeg/**` from `oxlint` scanning in `.oxlintrc.json`.
  - Exclude `['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core']` from Vite `optimizeDeps` in `vite.config.ts`.
- [x] **Task 3.2 — Implement Singleton Loader & Blob URL Error Cleanup (`src/ffmpeg/forger.ts`)**
  - Load `FFMPEG_CORE_JS_URL` and `FFMPEG_CORE_WASM_URL` via `toBlobURL`, deduplicate concurrent `loadPromise` callers, and revoke `coreURL`/`wasmURL` if `ffmpeg.load` throws.
- [x] **Task 3.3 — Implement `buildFilterComplex` & `buildFFmpegArgs` (`src/ffmpeg/forger.ts`)**
  - Generate `[0:v]trim` + `setpts=PTS-STARTPTS` and `[0:a]atrim` + `asetpts=PTS-STARTPTS` chains feeding `concat=n=N:v=1:a=1[outv][outa]`.
  - Configure `-c:v libx264 -preset ultrafast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart`.
- [x] **Task 3.4 — Implement Concurrency Lock & `try...finally` MEMFS Sweep (`src/ffmpeg/forger.ts`)**
  - Guard `forgeVideo` with `isForging` / `isForgeInProgress()`.
  - Evict `input-${runId}` before `readFile`, copy output into a standard `ArrayBuffer`-backed `Uint8Array`, and sweep all run/temp files in `cleanupMemfsRunFiles` inside `finally`.
- [x] **Task 3.5 — Verify Hardening Guarantees (`tests/hardening.test.ts`)**
  - Assert zero external CDN URLs in `FFMPEG_CORE_*_URL`.
  - Assert `ultrafast` + `+faststart` CLI flags.
  - Assert `finally` cleanup deletes `input-*`, `forged-*`, and `pass-0.mbtree` even when `exec` returns exit code `1` and `deleteFile` throws.
  - Assert concurrent `forgeVideo` invocation rejects with `/already running/i` while keeping lock held until first job completes.
