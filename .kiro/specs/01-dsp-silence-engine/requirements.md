# Spec 01 — DSP Silence Detection Engine (`requirements.md`)

## Scope & Grounded Modules
- **Implementation**: `src/dsp/silenceDetector.ts` (`detectActiveSegments`, `WINDOW_DURATION_SEC = 0.02`)
- **Shared Contracts**: `src/types.ts` (`SilenceConfig`, `AudioSegment`)
- **Caller Integration**: `src/App.tsx` (`DEFAULT_SILENCE_CONFIG`, `analyzeFile`, `cutPlan` `useMemo`)
- **Verification Suite**: `tests/silenceDetector.test.ts` (7 Vitest unit + `fast-check` property tests)

---

## EARS Requirements

### REQ-DSP-01 — Pure Deterministic Signal Processing (Ubiquitous)
The `detectActiveSegments(audioBuffer: AudioBuffer, config: SilenceConfig): AudioSegment[]` function in `src/dsp/silenceDetector.ts` **shall** operate as a pure, side-effect-free function over PCM channel buffers and `SilenceConfig` with zero network I/O, DOM access, mutable module state, or non-deterministic clocks.

### REQ-DSP-02 — Empty & Zero-Channel Audio Guardrail (Unwanted Behavior)
**If** `audioBuffer.length === 0`, `audioBuffer.duration === 0`, `audioBuffer.numberOfChannels === 0`, or every 20 ms RMS window evaluates to `0` (digital silence), **then** `detectActiveSegments` **shall** immediately return an empty `AudioSegment[]` (`[]`) without throwing or emitting `NaN` boundaries.

### REQ-DSP-03 — Sample-Accurate Mono Downmix & 20 ms RMS Windowing (Event-Driven)
**When** `detectActiveSegments` analyzes a multi-channel `AudioBuffer`, the system **shall**:
1. Compute `windowSize = Math.max(1, Math.round(sampleRate * 0.02))` corresponding to `WINDOW_DURATION_SEC = 0.02` (20 ms frames, e.g., `960` samples at `48 kHz` or `20` samples at `1 kHz`).
2. Downmix all channels sample-by-sample via arithmetic mean (`mono = channelSum / numberOfChannels`) **before** squaring, ensuring phase-coherent stereo signals are measured accurately and final partial windows divide by their exact sample count `(end - start)`.

### REQ-DSP-04 — Decibel Thresholding & Minimum Dead-Air Hysteresis (State-Driven)
**While** scanning contiguous 20 ms RMS windows, the system **shall** convert linear RMS to dBFS via `20 * Math.log10(rms + 1e-10)` (default `silenceThresholdDb = -35` dB) and **shall** strip a below-threshold run **only when** its duration `(windowSample(index) - windowSample(silenceStart)) / sampleRate` is greater than or equal to `config.minSilenceDurationSec` (default `0.6` s), preserving natural intra-sentence breath pauses shorter than `0.6` s.

### REQ-DSP-05 — Clamped Pre/Post-Roll Padding & Coalescing (Event-Driven)
**When** emitting an active speech range `[firstWindow, nextWindow)`, the system **shall** expand start backward by `Math.max(0, config.preRollMs) / 1000` (default `120` ms) clamped to `0`, expand end forward by `Math.max(0, config.postRollMs) / 1000` (default `150` ms) clamped to `audioBuffer.duration`, and coalesce adjacent segments whenever `start <= previous.end`.

### REQ-DSP-06 — Overlap-Weighted Segment Energy Attribution (Ubiquitous)
For each coalesced `AudioSegment`, the system **shall** compute `segment.energy` as the exact time-overlap-weighted mean RMS across all intersecting 20 ms windows (`weightedRms / (segment.end - segment.start)`), providing downstream `planCutSegments` with a duration-normalized acoustic energy score.
