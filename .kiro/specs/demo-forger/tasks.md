# StitchCut — Implementation Tasks

## Phase 1: Foundation (Current)
- [x] Initialize Vite + React + TypeScript + Tailwind CSS v4 project
- [x] Install runtime (`@ffmpeg/ffmpeg`, `@ffmpeg/util`, `lucide-react`) and dev (`tailwindcss`, `@tailwindcss/vite`, `vitest`, `fast-check`) dependencies
- [x] Configure COOP/COEP headers in `vite.config.ts` (dev & preview) and `vercel.json`, and exclude FFmpeg packages from `optimizeDeps`
- [x] Author `.kiro/` specs, steering rules, PBT hook, and MCP server registration
- [x] Define shared TypeScript contracts in `src/types.ts`
- [x] Create typed stubs for `src/dsp/silenceDetector.ts` and `src/planner/segmentPlanner.ts`
- [x] Verify clean `npm run build` with zero TypeScript errors

## Phase 2: Web Audio DSP Engine
- [ ] Implement RMS dBFS windowing and silence thresholding in `src/dsp/silenceDetector.ts`
- [ ] Implement `minSilenceDurationSec` gap bridging and `preRollMs`/`postRollMs` clamping
- [ ] Add Vitest unit and property-based tests for `detectActiveSegments`

## Phase 3: Time-Budgeted Segment Planner & PBT
- [ ] Implement deterministic segment clamping, merging, and energy-prioritized budget trimming in `src/planner/segmentPlanner.ts`
- [ ] Implement exhaustive invariant checking in `validateCutPlan`
- [ ] Add `fast-check` PBT suite verifying bounds, non-overlap, duration conservation, budget compliance, and determinism

## Phase 4: FFmpeg.wasm Client-Side Forger
- [ ] Implement lazy FFmpeg.wasm loader with `crossOriginIsolated` guard
- [ ] Build trim/concat filtergraph generator from `CutPlan`
- [ ] Wire `ForgeProgress` reporting and temporary virtual FS cleanup

## Phase 5: Frankenstein Studio UI
- [ ] Build local file dropzone & Web Audio waveform timeline with silence/active overlays
- [ ] Add `SilenceConfig` controls (threshold, min silence, pre/post roll, target demo budget)
- [ ] Add real-time `CutPlan` stats (original, forged, stripped durations) and MP4 preview/download

## Phase 6: Kiro MCP Server
- [ ] Scaffold `mcp-server/` package building to `mcp-server/dist/index.js`
- [ ] Expose StitchCut planning & `CutPlan` validation tools over MCP stdio
- [ ] Verify end-to-end tool invocation via `.kiro/settings/mcp.json`
