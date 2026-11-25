# Spec 04 — Input Guardrails, ObjectURL Lifecycle & Sample Synthesis (`requirements.md`)

## Scope & Grounded Modules
- **Guardrails Module**: `src/mediaGuardrails.ts` (`MAX_FILE_SIZE_BYTES`, `MAX_VIDEO_DURATION_SEC`, `validateMediaFileSize`, `validateMediaDuration`, `probeVideoDurationSec`)
- **Sample Synthesizer**: `src/components/sampleGenerator.ts` (`loadSampleVideo`, `hasValidVideoSignature`, `synthesizeTestClip`)
- **UI & Lifecycle Wiring**: `src/App.tsx` (`forgedUrlRef`, `sourcePreviewUrlRef`, `mediaEpochRef`, `replaceForgedUrl`, `revokeAllPreviewUrls`), `src/components/UploadZone.tsx`
- **Verification Suite**: `tests/hardening.test.ts` (`Client-side input guardrails`)

---

## EARS Requirements

### REQ-GRD-01 — Pre-Allocation 250 MB File Size Cap (Unwanted Behavior)
**If** a selected or dropped `File` has `size <= 0`, non-finite `size`, or `size > MAX_FILE_SIZE_BYTES` (`250 * 1024 * 1024` = `262,144,000` bytes), **then** `validateMediaFileSize` **shall** reject the file **before** `file.arrayBuffer()` is called and surface an actionable Browser Memory Guardrail alert in `UploadZone.tsx`.

### REQ-GRD-02 — Dual-Stage 600-Second Duration Guardrail (Unwanted Behavior)
**When** ingesting a media file in `src/App.tsx`, the system **shall** enforce `MAX_VIDEO_DURATION_SEC = 600` (10 minutes) in two stages:
1. **Fast Metadata Probe (`probeVideoDurationSec`)**: Inspect `<video preload="metadata">` with a `3000 ms` timeout and guaranteed `URL.revokeObjectURL(tempUrl)` cleanup prior to PCM decoding.
2. **Authoritative Post-Decode Check (`validateMediaDuration`)**: Re-validate `decoded.duration` after `audioCtx.decodeAudioData` to catch WebM `MediaRecorder` streams whose container headers report `Infinity` or `NaN` duration.

### REQ-GRD-03 — Epoch-Guarded `ObjectURL` & `AudioContext` Lifecycle (Ubiquitous)
`src/App.tsx` **shall** track `sourcePreviewUrlRef`, `forgedUrlRef`, and monotonic `mediaEpochRef` counters so that:
- Replacing, clearing, rejecting, re-forging, or unmounting always revokes prior `blob:` URLs via `URL.revokeObjectURL`.
- Stale async `analyzeFile` or `handleForge` completions from superseded epochs revoke any newly created `ObjectURL` immediately and never overwrite active UI state.
- Every temporary `AudioContext` is closed inside `finally` (`audioCtx.close()`).

### REQ-GRD-04 — Zero-Asset 1-Click Sample Specimen Synthesis (Event-Driven)
**When** the user clicks **"Try Sample Specimen"** in `UploadZone.tsx`, `loadSampleVideo` in `src/components/sampleGenerator.ts` **shall**:
1. Check `/sample-demo.mp4` and verify magic-byte container signatures (`ftyp` for ISO-BMFF/MP4 or `0x1A 0x45 0xDF 0xA3` for WebM/EBML) so Vite's SPA HTML fallback is never mistaken for video.
2. Fall back seamlessly to `synthesizeTestClip(6)`, generating a 6-second `640x360 @ 24fps` Canvas + WebAudio + `MediaRecorder` clip containing three distinct active tone bursts (`[0.4–1.8s]`, `[3.0–4.2s]`, `[5.0–5.8s]`) separated by `-100 dBFS` (`1e-5` gain) dead-air gaps.
