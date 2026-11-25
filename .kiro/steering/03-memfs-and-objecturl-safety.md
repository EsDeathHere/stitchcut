---
inclusion: always
---

# Steering 03 — MEMFS Heap Hygiene, Concurrency Lock & ObjectURL Safety

## Context
Client-side video transcoding operates inside tight WebAssembly linear memory and browser Blob store limits. Leaking a single 200 MB input buffer in Emscripten `MEMFS` or forgetting to revoke a `blob:` URL across re-forges rapidly exhausts tab memory.

## Mandatory Rules
1. **Single-Flight Forger Lock (`src/ffmpeg/forger.ts`)**:
   - `@ffmpeg/ffmpeg` instances are not re-entrant across concurrent `exec()` calls. `forgeVideo` must check `isForging` (`isForgeInProgress()`) at entry, reject overlapping invocations immediately, and release `isForging = false` exclusively inside its outer `finally` block.
2. **Two-Phase MEMFS Purge (`src/ffmpeg/forger.ts`)**:
   - Use unique per-run filenames (`input-${runId}.${ext}`, `forged-${runId}.mp4`).
   - Delete `input-${runId}.${ext}` via `safeDeleteFile` immediately after `ffmpeg.exec(args)` succeeds (before allocating the output `Uint8Array` copy and `Blob`) to minimize peak heap footprint.
   - Always detach `ffmpeg.off('log', ...)` / `ffmpeg.off('progress', ...)` and run `cleanupMemfsRunFiles` inside `finally` to sweep `input-*`, `forged-*`, `.mbtree`, `.log`, and `.temp` files even when `exec` fails.
3. **Epoch-Tracked `ObjectURL` & `AudioContext` Lifecycle (`src/App.tsx`, `src/mediaGuardrails.ts`)**:
   - Every `URL.createObjectURL(...)` call must have a deterministic `URL.revokeObjectURL(...)` counterpart:
     - `probeVideoDurationSec` revokes its temporary metadata probe URL inside `finish()`.
     - `App.tsx` tracks `sourcePreviewUrlRef` and `forgedUrlRef`, revoking them on replace, clear, guardrail rejection, re-forge, superseded `mediaEpochRef`, and component unmount.
   - Always close transient `AudioContext` instances in `finally` (`await audioCtx.close().catch(() => undefined)`).
