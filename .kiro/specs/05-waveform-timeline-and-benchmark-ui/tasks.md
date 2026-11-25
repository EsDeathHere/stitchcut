# Spec 05 — Interactive Waveform Timeline, Benchmark Telemetry & COOP/COEP Studio (`tasks.md`)

## Implementation & Verification Checklist

- [x] **Task 5.1 — Configure COOP/COEP Headers & Isolation Diagnostics (`vite.config.ts`, `vercel.json`, `IsolationBanner.tsx`)**
  - Configure `same-origin` and `require-corp` headers in Vite `server`/`preview` and `vercel.json`.
  - Render live `COI Active` / `COI Inactive` pill in `App.tsx` header and fallback diagnostic `IsolationBanner`.
- [x] **Task 5.2 — Build 96-Bin Mono RMS Waveform & Interactive Inspector (`src/components/TimelineBar.tsx`)**
  - Implement strided `computeWaveformBins(audioBuffer, 96)` memoized on `audioBuffer`.
  - Overlay clickable/hoverable retained segment buttons over `.dead-air-pattern` with live `dBFS` & timecode readout plus quick-select segment pills.
- [x] **Task 5.3 — Add Real-Time Energy Condenser Controls (`src/components/ControlPanel.tsx`)**
  - Wire accessible range sliders for `silenceThresholdDb`, `minSilenceDurationSec`, and `targetBudgetSec` with one-click reset to `DEFAULT_SILENCE_CONFIG`.
- [x] **Task 5.4 — Instrument Local Forge Benchmark & Stage Telemetry (`src/App.tsx`, `src/components/ForgeWorkspace.tsx`)**
  - Measure `dspAnalyzeMs` and WASM `elapsedMs` via `performance.now()`.
  - Render the 4-metric **Local Forge Benchmark** readout (WASM Stitch Time, DSP + Cut Plan, Throughput, MEMFS Hygiene) alongside zero-upload privacy verification and inline `<video>` MP4 preview/download.
