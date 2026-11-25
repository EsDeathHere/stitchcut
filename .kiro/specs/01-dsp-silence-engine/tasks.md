# Spec 01 — DSP Silence Detection Engine (`tasks.md`)

## Implementation & Verification Checklist

- [x] **Task 1.1 — Define DSP Contracts (`src/types.ts`)**
  - Define `SilenceConfig` (`silenceThresholdDb`, `minSilenceDurationSec`, `preRollMs`, `postRollMs`, `targetBudgetSec`) and `AudioSegment` (`start`, `end`, `energy`).
- [x] **Task 1.2 — Implement 20 ms Mono RMS Windowing (`src/dsp/silenceDetector.ts`)**
  - Compute `windowSize = Math.max(1, Math.round(sampleRate * 0.02))`.
  - Downmix multi-channel PCM sample-by-sample and store window RMS values in `Float64Array`.
  - Handle trailing partial PCM windows using exact sample count `(end - start)`.
- [x] **Task 1.3 — Implement Hysteresis Gate & Roll Coalescing (`src/dsp/silenceDetector.ts`)**
  - Apply `20 * Math.log10(rms + 1e-10) < config.silenceThresholdDb` gate and `minSilenceDurationSec` duration check.
  - Apply clamped `preRollMs` / `postRollMs` expansion and merge overlapping/touching active intervals (`start <= previous.end`).
- [x] **Task 1.4 — Compute Overlap-Weighted Segment Energy (`src/dsp/silenceDetector.ts`)**
  - Weight each intersected 20 ms window's RMS by temporal overlap and divide by `(segment.end - segment.start)`.
- [x] **Task 1.5 — Unit & Property-Based Verification (`tests/silenceDetector.test.ts`)**
  - Verify short pause retention vs. minimum-duration dead-air stripping.
  - Verify stereo phase cancellation / downmix accuracy (`0.5` + `-0.5` -> `0`, `0.75` + `-0.25` -> `0.25`).
  - Verify fractional padding energy weighting (`20 / 35` exact ratio) and overlap coalescing.
  - Run 100 `fast-check` property iterations over randomized leading/active/trailing window counts and `[0..350 ms]` pre/post roll values.
- [x] **Task 1.6 — Wire Real-Time Re-Planning in Studio (`src/App.tsx`)**
  - Memoize `detectActiveSegments(audioBuffer, config)` inside `App.tsx` so slider adjustments recompute segments instantaneously without re-decoding audio.
