# Spec 05 — Interactive Waveform Timeline, Benchmark Telemetry & COOP/COEP Studio (`requirements.md`)

## Scope & Grounded Modules
- **Studio Orchestrator**: `src/App.tsx` (`isCrossOriginIsolated`, `dspAnalyzeMs`, `forgeBenchmark`, `handleForge`)
- **Waveform & Segment Inspector**: `src/components/TimelineBar.tsx` (`WAVEFORM_BIN_COUNT = 96`, `computeWaveformBins`, `formatEnergyDb`)
- **Benchmark & Output Panel**: `src/components/ForgeWorkspace.tsx` (`ForgeBenchmark`, `StageLogEntry`, `formatElapsed`)
- **Controls & Isolation Diagnostics**: `src/components/ControlPanel.tsx`, `src/components/IsolationBanner.tsx`
- **COOP/COEP Configuration**: `vite.config.ts`, `vercel.json`, `src/index.css`

---

## EARS Requirements

### REQ-UI-01 — Cross-Origin Isolation Status & Diagnostic Banner (State-Driven)
**While** the Studio UI renders in `src/App.tsx`, the header **shall** display live `window.crossOriginIsolated` status (`COI Active` vs. `COI Inactive`) alongside `FFmpeg.wasm (Self-Hosted)`. **If** `window.crossOriginIsolated === false`, **then** `IsolationBanner.tsx` **shall** display a dismissible alert instructing the operator to serve with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.

### REQ-UI-02 — 96-Bin Mono RMS Waveform & Dead-Air Contrast (Event-Driven)
**When** an `AudioBuffer` and `CutPlan` are available, `TimelineBar.tsx` **shall** downsample mono PCM channels into `WAVEFORM_BIN_COUNT = 96` normalized RMS bars (`computeWaveformBins` with strided sampling `Math.max(1, Math.floor(span / 256))`) and visually distinguish **Retained High-Energy Segments** (emerald bars + interactive segment overlays) from **Trimmed Dead Air** (muted zinc bars over `.dead-air-pattern` diagonal hatch).

### REQ-UI-03 — Interactive Segment Splice & RMS Energy Inspector (Event-Driven)
**When** a user hovers, focuses, or clicks any retained segment overlay or quick-selector pill in `TimelineBar.tsx`, the component **shall** highlight that segment on the waveform and display its 1-based index, exact `[start -> end]` timecodes, duration in seconds, and RMS energy in `dBFS` (`20 * Math.log10(rms + 1e-10)`).

### REQ-UI-04 — Local Forge Benchmark & Zero-Upload Readout (Event-Driven)
**When** `forgeVideo` completes in `src/App.tsx`, the system **shall** record `performance.now()` elapsed duration (`elapsedMs`) alongside `dspAnalyzeMs`, `segmentCount`, `forgedDurationSec`, and `outputBytes`, and `ForgeWorkspace.tsx` **shall** render a **Local Forge Benchmark** panel showing:
1. **WASM Stitch Time** formatted in both seconds and milliseconds (`formatElapsed`).
2. **DSP + Cut Plan** local analysis latency in `ms`.
3. **Throughput** (`forgedDurationSec / (elapsedMs / 1000)` real-time factor).
4. **Zero-Server Privacy & MEMFS Hygiene** confirmation (`0 Bytes Uploaded • Zero-Server Privacy` and `Scratch Purged`).

### REQ-UI-05 — Live Threshold & Budget Re-Planning Controls (State-Driven)
**While** not actively analyzing or forging (`!isBusy`), `ControlPanel.tsx` **shall** allow real-time adjustment of `silenceThresholdDb` (`-60` to `-10` dB), `minSilenceDurationSec` (`0.1` to `3.0` s), and `targetBudgetSec` (`10` to `600` s), immediately updating the `TimelineBar` cut plan without re-decoding PCM audio.
