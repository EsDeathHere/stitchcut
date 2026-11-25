---
inclusion: always
---

# Steering 06 — Pure Deterministic DSP Signal Processing

## Context
`src/dsp/silenceDetector.ts` transforms decoded WebAudio PCM buffers into energy-annotated `AudioSegment[]` intervals. Predictable splice quality depends on exact sample-level math and natural speech roll padding.

## Mandatory Rules
1. **Pure Functional Discipline**:
   - `src/dsp/silenceDetector.ts` and `src/planner/segmentPlanner.ts` must remain 100% pure TypeScript modules: no DOM globals, no `AudioContext` instantiation inside DSP math, no `Date.now()` / `Math.random()`, and no mutation of caller-owned arrays or `SilenceConfig` objects.
2. **Sample-Accurate Mono Downmix & 20 ms Windowing**:
   - Maintain `WINDOW_DURATION_SEC = 0.02` (`windowSize = Math.max(1, Math.round(sampleRate * 0.02))`).
   - Downmix multi-channel PCM **sample-by-sample** (`mono = channelSum / numberOfChannels`) before squaring into `Float64Array` RMS accumulators, and divide final partial windows by their true sample count `(end - start)`.
3. **dBFS Floor, Hysteresis & Padding Preservation**:
   - Convert linear RMS to decibels with `20 * Math.log10(rms + 1e-10)` (default gate `-35 dB`).
   - Excise below-threshold runs **only** when their duration meets or exceeds `minSilenceDurationSec` (default `0.6 s`).
   - Expand retained speech bursts by `preRollMs` (`120 ms`) and `postRollMs` (`150 ms`) clamped to `[0, duration]`, coalesce touching/overlapping padded spans (`start <= previous.end`), and compute `segment.energy` weighted by exact window-segment overlap duration.
