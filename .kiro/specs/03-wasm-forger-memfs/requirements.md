# Spec 03 — Self-Hosted FFmpeg.wasm Forger & MEMFS Hygiene (`requirements.md`)

## Scope & Grounded Modules
- **Implementation**: `src/ffmpeg/forger.ts` (`FFMPEG_CORE_JS_URL`, `FFMPEG_CORE_WASM_URL`, `forgeVideo`, `isForgeInProgress`, `buildFilterComplex`, `buildFFmpegArgs`, `__setForgerDepsForTests`)
- **Static Assets**: `public/ffmpeg/ffmpeg-core.js`, `public/ffmpeg/ffmpeg-core.wasm`
- **Build & Isolation Config**: `vite.config.ts`, `vercel.json`, `.oxlintrc.json`
- **Verification Suite**: `tests/hardening.test.ts` (FFmpeg self-hosting, encoding flags, MEMFS `finally` cleanup, concurrency lock)

---

## EARS Requirements

### REQ-FFM-01 — Strictly Self-Hosted WASM Core Assets (Ubiquitous)
`src/ffmpeg/forger.ts` **shall** load FFmpeg WebAssembly binaries exclusively from same-origin paths `FFMPEG_CORE_JS_URL = '/ffmpeg/ffmpeg-core.js'` and `FFMPEG_CORE_WASM_URL = '/ffmpeg/ffmpeg-core.wasm'` bundled in `public/ffmpeg/` via `@ffmpeg/util`'s `toBlobURL`, with zero runtime dependencies on `unpkg.com`, `jsdelivr.net`, or any external CDN.

### REQ-FFM-02 — Single-Job Concurrency Lock (Unwanted Behavior)
**If** `forgeVideo` is invoked while `isForgeInProgress()` is `true`, **then** `forgeVideo` **shall** immediately reject with `'A video forge job is already running. Please wait for the current encode to finish.'` without corrupting the active FFmpeg instance or unlocking the in-flight job.

### REQ-FFM-03 — Single-Pass `filter_complex` Trim & Concat Graph (Event-Driven)
**When** `buildFilterComplex(segments)` constructs the FFmpeg filtergraph for `N >= 1` segments, the system **shall** emit paired `[0:v]trim=start=S:end=E,setpts=PTS-STARTPTS[vI]` and `[0:a]atrim=start=S:end=E,asetpts=PTS-STARTPTS[aI]` chains (formatted to millisecond precision `.toFixed(3)`) followed by `concat=n=N:v=1:a=1[outv][outa]` to prevent cumulative A/V timestamp drift across splices.

### REQ-FFM-04 — Fast Browser H.264/AAC Encoding Profile (Ubiquitous)
`buildFFmpegArgs(inputName, filterComplex, outputName)` **shall** configure `-c:v libx264 -preset ultrafast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart` so stitched `.mp4` outputs encode rapidly in single-threaded or worker WASM contexts and play immediately in HTML5 `<video>` elements across all browsers.

### REQ-FFM-05 — Deterministic MEMFS Heap Cleanup in `try...finally` (Ubiquitous)
`forgeVideo` **shall**:
1. Delete `input-${runId}.${ext}` immediately after `ffmpeg.exec(args)` succeeds (before allocating the output `Blob` copy) to lower peak browser heap usage.
2. Unregister `log` and `progress` listeners and invoke `cleanupMemfsRunFiles(ffmpeg, runId, trackedFiles)` inside `finally` — sweeping `input-*`, `forged-*`, `.mbtree`, `.log`, and `.temp` artifacts via `safeDeleteFile` even if `exec`, `readFile`, or `deleteFile` throws — before resetting `isForging = false`.
