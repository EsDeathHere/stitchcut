# Spec 04 — Input Guardrails, ObjectURL Lifecycle & Sample Synthesis (`tasks.md`)

## Implementation & Verification Checklist

- [x] **Task 4.1 — Implement Client-Side Media Guardrails (`src/mediaGuardrails.ts`)**
  - Export `MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024` and `MAX_VIDEO_DURATION_SEC = 600`.
  - Implement `validateMediaFileSize`, `validateMediaDuration`, and `probeVideoDurationSec` with guaranteed `tempUrl` revocation and `3000 ms` fallback timeout.
- [x] **Task 4.2 — Implement Ref-Counted / Epoch-Guarded `ObjectURL` Cleanup (`src/App.tsx`)**
  - Manage `forgedUrlRef` and `sourcePreviewUrlRef` through `replaceForgedUrl`, `revokeSourcePreviewUrl`, `revokeAllPreviewUrls`, and unmount `useEffect`.
  - Guard async media decode and WASM forge callbacks with `mediaEpochRef` and `mountedRef`.
- [x] **Task 4.3 — Build 1-Click In-Browser Specimen Synthesizer (`src/components/sampleGenerator.ts`)**
  - Validate `/sample-demo.mp4` magic bytes (`ftyp` / EBML) in `hasValidVideoSignature`.
  - Synthesize a 6-second `640x360` Canvas + WebAudio clip with 3 active speech-like bursts (`[0.4–1.8s]`, `[3.0–4.2s]`, `[5.0–5.8s]`) and guaranteed track/`AudioContext` teardown in `finally`.
- [x] **Task 4.4 — Render Guardrail Alerts & Specimen Controls (`src/components/UploadZone.tsx`)**
  - Surface dismissible `role="alert"` Browser Memory Guardrail banner when `guardrailError` is set.
  - Provide drag-and-drop, keyboard-accessible file picker, and **"Try Sample Specimen"** button.
- [x] **Task 4.5 — Unit-Test Size & Duration Boundaries (`tests/hardening.test.ts`)**
  - Verify exact boundary acceptance at `250 MB` and `600 s`, rejection at `250 MB + 1 B` and `600.1 s`, and rejection of `NaN` / `Infinity` durations.
