# StitchCut — Requirements Specification (EARS Format)

## Overview
**StitchCut** is a zero-server, browser-native demo video forger built for **Kiroween 2026 (Frankenstein Category)**. It combines Web Audio API DSP silence detection, a deterministic property-tested time-budgeted segment planner, in-browser FFmpeg.wasm video stitching, and a local Kiro MCP server to turn raw screen recordings into tight, hackathon-ready demo videos without ever uploading media to a remote server.

---

## 1. Zero-Server Media Ingestion
- **REQ-ING-01 (Ubiquitous):** The system shall process all video and audio payloads exclusively inside the user's browser runtime without transmitting media bytes to any remote server or third-party API.
- **REQ-ING-02 (Event-Driven):** When a user drops or selects a local video file (MP4, WebM, MOV), the system shall validate the file container and decode its audio track locally via the Web Audio API (`AudioContext.decodeAudioData`) or FFmpeg.wasm demuxing.
- **REQ-ING-03 (Unwanted Behavior):** If the browser context lacks cross-origin isolation (`window.crossOriginIsolated === false`), then the system shall surface a clear diagnostic error indicating that COOP/COEP headers are required for `SharedArrayBuffer` and FFmpeg.wasm execution.

## 2. Web Audio DSP Silence Detection
- **REQ-DSP-01 (Ubiquitous):** The DSP silence detector (`src/dsp/silenceDetector.ts`) shall be implemented as a pure, deterministic function over PCM audio samples and `SilenceConfig` parameters with zero network, DOM, or wall-clock side effects.
- **REQ-DSP-02 (Event-Driven):** When `detectActiveSegments(audioBuffer, config)` is invoked, the system shall compute frame-level RMS energy in decibels (dBFS) and classify contiguous regions exceeding `silenceThresholdDb` as active speech/action segments.
- **REQ-DSP-03 (State-Driven):** While merging adjacent active windows, the system shall preserve pauses shorter than `minSilenceDurationSec` and expand each active segment by `preRollMs` before start and `postRollMs` after end, clamped to `[0, audioBuffer.duration]`.
- **REQ-DSP-04 (Unwanted Behavior):** If an audio buffer is completely silent or has zero duration, then the system shall return an empty segment array `[]` without throwing.

## 3. Time-Budgeted Segment Planner & PBT Invariants
- **REQ-PLN-01 (Ubiquitous):** The segment planner (`src/planner/segmentPlanner.ts`) shall be a pure, deterministic module that transforms candidate `AudioSegment[]` into a validated `CutPlan` respecting `targetBudgetSec`.
- **REQ-PLN-02 (Event-Driven):** When `planCutSegments(segments, videoDuration, targetBudgetSec)` is called, the system shall sort, clamp, merge overlapping segments, and—if total active duration exceeds `targetBudgetSec`—select or trim segments deterministically (prioritizing higher-energy segments while preserving chronological playback order).
- **REQ-PLN-03 (Ubiquitous — PBT Invariants):** Every `CutPlan` produced by `planCutSegments` shall satisfy all property-based testing invariants verified by `validateCutPlan` and `fast-check`:
  1. **Bounds:** For every segment `s`, `0 <= s.start < s.end <= videoDuration`.
  2. **Strict Chronological Non-Overlap:** For every consecutive pair `segments[i]`, `segments[i+1]`, `segments[i].end <= segments[i+1].start`.
  3. **Duration Conservation:** `forgedDuration` equals the sum of `(s.end - s.start)` across `segments` (within floating-point epsilon), and `strippedDuration` equals `originalDuration - forgedDuration`.
  4. **Budget Compliance:** Whenever `targetBudgetSec > 0`, `forgedDuration <= targetBudgetSec + epsilon` and `withinBudget === true` (or `withinBudget === (forgedDuration <= targetBudgetSec + epsilon)`).
  5. **Determinism:** Calling `planCutSegments` twice with identical inputs shall produce deeply equal `CutPlan` outputs.

## 4. FFmpeg.wasm Client-Side Forging
- **REQ-FFM-01 (Event-Driven):** When the user initiates forging with a validated `CutPlan`, the system shall load `@ffmpeg/ffmpeg` in-browser, write the source video to the virtual filesystem, execute trim/concat filtergraphs matching `CutPlan.segments`, and output a downloadable MP4 blob.
- **REQ-FFM-02 (State-Driven):** While loading FFmpeg.wasm, analyzing audio, or forging video, the system shall emit structured `ForgeProgress` updates (`idle | loading | analyzing | forging | done | error`, `percent` in `[0, 100]`, and human-readable `message`).
- **REQ-FFM-03 (Unwanted Behavior):** If FFmpeg.wasm fails during execution or is cancelled, then the system shall transition `ForgeProgress.stage` to `'error'`, clean up temporary virtual filesystem entries, and preserve the original uploaded file for retry.

## 5. Kiro MCP Server Integration
- **REQ-MCP-01 (Ubiquitous):** The repository shall include a local MCP server (`stitchcut-mcp`, built to `mcp-server/dist/index.js` and registered in `.kiro/settings/mcp.json`) exposing deterministic StitchCut planning and validation tools to Kiro.
- **REQ-MCP-02 (Event-Driven):** When an agent invokes `stitchcut-mcp` tools (e.g., planning cut segments or validating a `CutPlan` against a target demo budget), the server shall execute the same deterministic invariants and return structured JSON results.
