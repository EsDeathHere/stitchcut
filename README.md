# StitchCut — Deterministic, Energy-Based Video Condensing Engine

> **Kiroween 2026 — Frankenstein Category**
> *Stitching four disparate runtimes — WebAudio PCM DSP, `fast-check` property-verified interval planning, self-hosted `FFmpeg.wasm`, and a stdio Model Context Protocol (`MCP`) server — into a single zero-server video condensing studio.*

**StitchCut** ("Stitcher's Lab") turns raw, unedited screen recordings into tight, time-budgeted demo videos **100% locally in browser memory** — with **zero cloud uploads, zero external CDNs, and zero LLM hallucinations**. Instead of claiming black-box semantic AI, StitchCut executes deterministic 20 ms mono RMS signal analysis, excises dead air (`>= 0.6 s` below `-35 dBFS`), ranks speech bursts by duration-weighted acoustic energy, guarantees exact target-budget compliance down to IEEE-754 ULP precision, and splices frame-accurate H.264/AAC `.mp4` files inside Emscripten `MEMFS`.

---

## Why Frankenstein Category?

StitchCut stitches four distinct systems engineering domains that rarely coexist in one cohesive runtime:

1. **Web Audio API Signal Processing (`src/dsp/silenceDetector.ts`)** — Sample-by-sample multi-channel mono downmixing, `Float64Array` 20 ms RMS windowing, dBFS hysteresis gating, clamped `120 ms / 150 ms` breath padding, and overlap-weighted energy scoring.
2. **Formally Verified Interval Mathematics (`src/planner/segmentPlanner.ts`)** — Duration-weighted energy merging, greedy energy-first budget allocation, IEEE-754 endpoint bisection (`lastFittingEnd`), and playback-order float rounding correction (`correctPlaybackTotal`) verified across **1,100+ `fast-check` property-based test runs**.
3. **Self-Hosted WebAssembly Media Transcoding (`src/ffmpeg/forger.ts`)** — Same-origin `/ffmpeg/ffmpeg-core.{js,wasm}` worker execution under strict `COOP: same-origin` / `COEP: require-corp` isolation, single-pass `trim`/`atrim` + `concat` filtergraphs,concurrency locking, and deterministic `try...finally` `MEMFS` heap purging.
4. **Agentic Model Context Protocol Server (`mcp-server/`)** — Standalone stdio `@modelcontextprotocol/sdk` server guarded by strict Zod v4 perimeter schemas and exact integer-microsecond arithmetic so Kiro IDE and CLI agents can plan and audit cut lists programmatically.

---

## System Architecture

```text
+-----------------------------------------------------------------------------------+
|                     MODE 1: ZERO-SERVER BROWSER STUDIO (COOP/COEP)                |
|                                                                                   |
|  [Raw Specimen <=250MB / <=600s]  or  [1-Click Built-In 6s Lab Specimen Synth]    |
|                 |                                     |                           |
|                 +------------------+------------------+                           |
|                                    v                                              |
|           +------------------------------------------------+                      |
|           | Input Guardrails (src/mediaGuardrails.ts)      |                      |
|           |  1. Size cap <= 250 MB (pre-ArrayBuffer)       |                      |
|           |  2. Metadata probe <= 600s + post-decode check |                      |
|           +------------------------+-----------------------+                      |
|                                    v                                              |
|           +------------------------------------------------+                      |
|           | WebAudio DSP Engine (src/dsp/silenceDetector)  |                      |
|           |  • Sample-accurate mono downmix                |                      |
|           |  • 20 ms RMS windows (-35 dBFS, 0.6s min gap)  |                      |
|           |  • 120 ms pre / 150 ms post roll coalescing    |                      |
|           +------------------------+-----------------------+                      |
|                                    v                                              |
|           +------------------------------------------------+                      |
|           | Segment Planner (src/planner/segmentPlanner)   | <--- 1,000+ PBT runs |
|           |  • Overlap merge + weighted RMS energy score   |      (fast-check)    |
|           |  • Energy-ranked trim <= targetBudgetSec       |                      |
|           |  • IEEE-754 bisection & chronological order    |                      |
|           +-----------+------------------------+-----------+                      |
|                       |                        |                                  |
|                       v                        v                                  |
|     +-------------------------------+  +--------------------------------------+   |
|     | Interactive 96-Bin Waveform   |  | Self-Hosted FFmpeg.wasm Forger       |   |
|     | (src/components/TimelineBar)  |  |  • public/ffmpeg/ffmpeg-core.{js,wasm}|  |
|     |  • Retained vs. Dead-Air bins |  |  • Single-pass trim/atrim + concat   |   |
|     |  • Hover/click dBFS inspector |  |  • Eager input eviction + finally GC |   |
|     +-------------------------------+  +-------------------+------------------+   |
|                                                            v                      |
|                                        +--------------------------------------+   |
|                                        | Stitched Output (.mp4) + Benchmark   |   |
|                                        |  • Local Forge Benchmark (ms / s)    |   |
|                                        |  • 0 Bytes Uploaded • Instant Play   |   |
|                                        +--------------------------------------+   |
+-----------------------------------------------------------------------------------+

+-----------------------------------------------------------------------------------+
|                     MODE 2: AGENTIC KIRO / CLI MCP WORKFLOW                       |
|                                                                                   |
|  [Kiro IDE / Agent] <=== stdio JSON-RPC ===> [stitchcut (mcp-server/dist/index.js)]|
|                                                   |-- Zod v4 Perimeter Schemas    |
|                                                   |-- plan_demo_cuts (int µs)     |
|                                                   +-- validate_cut_plan           |
+-----------------------------------------------------------------------------------+
```

---

## Dual Demonstration Modes

### Mode 1 — Zero-Server Browser Studio ("Stitcher's Lab")
Designed for zero-friction evaluation in under 30 seconds — no sample video files or external downloads required:
1. Click **"Try Sample Specimen"** in the top-right of the **Raw Specimen** card (`src/components/sampleGenerator.ts` synthesizes a playable 6-second `640x360` video+audio specimen in real time with three active tone bursts at `[0.4–1.8s]`, `[3.0–4.2s]`, and `[5.0–5.8s]` separated by `-100 dBFS` dead air).
2. Inspect the **96-bin Mono RMS Waveform & Cut Plan Timeline**: hover or click any emerald retained segment (or quick-select pill) to inspect its exact `[start -> end]` splice points and `dBFS` RMS energy, or drag the **Silence Threshold** (`-35 dB`) and **Target Time Budget** (`180 s`) sliders to watch the cut plan recompute instantaneously.
3. Click **"Forge Stitched MP4"** to run self-hosted `FFmpeg.wasm` (`libx264 -preset ultrafast -crf 23` + `aac 128k` + `+faststart`) inside browser `MEMFS`.
4. Review the **Local Forge Benchmark** readout (`WASM Stitch Time` in `s` and `ms`, `DSP + Cut Plan` latency, real-time throughput factor, `MEMFS Scratch Purged`, and `0 Bytes Uploaded • Zero-Server Privacy`) and play or download the stitched `.mp4` inline.

### Mode 2 — Agentic MCP Server Workflow (`mcp-server`)
Registered automatically in `.kiro/settings/mcp.json` (`mcpServers.stitchcut` -> `node mcp-server/dist/index.js`), exposing two deterministic tools over `StdioServerTransport`:
- **`plan_demo_cuts`** — Accepts `{ segments, videoDuration, targetBudgetSec }`, enforces strict Zod v4 bounds (`<= 500` segments, finite non-negative timestamps, `videoDuration <= 3600 s`), merges overlaps, ranks by energy in exact integer microseconds, trims to budget, and returns chronological cuts.
- **`validate_cut_plan`** — Audits any candidate cut list for non-negativity, valid intervals, `videoDuration` bounds, chronological ordering, non-overlap, and `targetBudgetSec` adherence.

---

## Quickstart & Verification Commands

### Prerequisites
- **Node.js** `>= 20` and **npm**
- Modern Chromium, Firefox, or Safari browser (`SharedArrayBuffer` enabled automatically via Vite's `COOP` / `COEP` headers)

### 1. Install & Launch Browser Studio
```bash
npm install
npm run dev
```
Open the local Vite URL (default `http://localhost:5173`) — confirm the **`COI Active`** badge in the top-right header, click **"Try Sample Specimen"**, then click **"Forge Stitched MP4"**.

### 2. Build & Test the MCP Server
```bash
cd mcp-server
npm install
npm run build
npm test
```

### 3. Run All Quality Gates (Tests, PBT, Lint, Production Build)
```bash
npm test && npm run lint && npm run build
(cd mcp-server && npm run build && npm test)
```

---

## Verified Engineering Quality Metrics

| Verification Suite | Command | Verified Result |
| :--- | :--- | :--- |
| **Vitest Unit & Hardening Suites** | `npm test` | **33 / 33 tests passing** (`silenceDetector`, `planner.pbt`, `hardening`) |
| **Property-Based Testing (`fast-check`)** | `npm test` | **1,100+ randomized invariant runs** (`1,000` planner + `100` DSP runs, `NaN`/`±Infinity`/ULP safe) |
| **MCP Server & Zod Perimeter Tests** | `cd mcp-server && npm test` | **6 / 6 `node:test` suites passing** (`>500` segs, `>3600s`, `NaN`/`±Infinity` rejected) |
| **Static Analysis (`oxlint`)** | `npm run lint` | **0 warnings, 0 errors** across all TypeScript & React sources |
| **Strict TypeScript + Vite Bundle** | `npm run build` | **Clean `tsc -b` + self-hosted WASM production build** |

---

## `.kiro/` Spec-Driven Engineering Inventory

StitchCut is engineered from the ground up with Kiro's spec-driven workflow — **32 committed `.kiro/` artifacts** (18 modular spec files, 8 steering docs, 5 agent hooks, and 1 workspace MCP config), every one grounded in real source paths, thresholds, and test suites:

### 6 Modular Specifications (`.kiro/specs/` — 18 Files)
| Spec Module | Files | Grounded Implementation & Tests |
| :--- | :--- | :--- |
| `01-dsp-silence-engine` | `requirements.md`, `design.md`, `tasks.md` | `src/dsp/silenceDetector.ts` (20 ms mono RMS, `-35 dB`, `0.6 s` min gap, roll coalescing) & `tests/silenceDetector.test.ts` |
| `02-deterministic-segment-planner` | `requirements.md`, `design.md`, `tasks.md` | `src/planner/segmentPlanner.ts` (weighted energy merge, IEEE-754 bisection trim) & `tests/planner.pbt.test.ts` |
| `03-wasm-forger-memfs` | `requirements.md`, `design.md`, `tasks.md` | `src/ffmpeg/forger.ts`, `public/ffmpeg/ffmpeg-core.{js,wasm}`, concurrency lock, `MEMFS` `finally` GC & `tests/hardening.test.ts` |
| `04-input-guardrails-and-sample-synth` | `requirements.md`, `design.md`, `tasks.md` | `src/mediaGuardrails.ts` (`<= 250 MB`, `<= 600 s`), `src/components/sampleGenerator.ts` & epoch-safe `ObjectURL` revocation |
| `05-waveform-timeline-and-benchmark-ui` | `requirements.md`, `design.md`, `tasks.md` | `src/App.tsx`, `TimelineBar.tsx` (96-bin RMS inspector), `ForgeWorkspace.tsx` (Local Forge Benchmark) & COOP/COEP headers |
| `06-mcp-stdio-orchestration` | `requirements.md`, `design.md`, `tasks.md` | `mcp-server/src/{index,schemas,plan}.ts` & `mcp-server/src/plan.test.ts` |

### 8 Architectural Steering Documents (`.kiro/steering/`)
1. `01-zero-server-architecture.md` — Zero cloud uploads & mandatory `COOP: same-origin` / `COEP: require-corp` parity (`vite.config.ts` + `vercel.json`).
2. `02-wasm-self-hosting.md` — Local `/ffmpeg/ffmpeg-core.{js,wasm}` bundling with zero external CDN dependencies.
3. `03-memfs-and-objecturl-safety.md` — Single-flight concurrency lock, eager input eviction, `finally` `MEMFS` sweep, and epoch-tracked `ObjectURL` revocation.
4. `04-input-and-zod-guardrails.md` — `250 MB` / `600 s` browser memory bounds & strict Zod v4 `finite()` / `500`-segment MCP caps.
5. `05-property-based-testing.md` — Five non-negotiable `CutPlan` invariants enforced across 1,000+ `fast-check` runs.
6. `06-dsp-signal-processing.md` — Pure functional 20 ms mono RMS math, dBFS floor, and overlap-weighted energy scoring.
7. `07-lint-and-build-standards.md` — `oxlint` zero-warning/zero-error policy, strict TypeScript `tsc -b`, and `.kiro/` Git tracking.
8. `08-product-positioning.md` — Honest positioning as a *Deterministic, Energy-Based Video Condensing Engine* (zero false semantic-AI claims).

### 5 Automated Agent Hooks (`.kiro/hooks/`)
1. `01-pbt-on-engine-change.kiro.hook` — Runs `npm test` automatically when `src/dsp/**`, `src/planner/**`, or `tests/**` changes.
2. `02-lint-on-src-save.kiro.hook` — Runs `npm run lint` (`oxlint`) whenever any file under `src/**` is saved.
3. `03-verify-mcp-boundaries.kiro.hook` — Compiles and runs `cd mcp-server && npm test` when `mcp-server/src/**` changes.
4. `04-verify-wasm-assets.kiro.hook` — Verifies non-empty `public/ffmpeg/ffmpeg-core.{js,wasm}` assets and runs `tests/hardening.test.ts` when `src/ffmpeg/**` or `vite.config.ts` changes.
5. `05-sync-specs-reminder.kiro.hook` — Prompts spec synchronization across `.kiro/specs/01..06` whenever new TypeScript modules are created.

---

## Repository Structure

```text
stitchcut/
├── .kiro/
│   ├── hooks/          # 5 automated quality, hardening & spec-sync hooks
│   ├── settings/       # mcp.json registering local `stitchcut` stdio MCP server
│   ├── specs/          # 6 modular EARS specs (18 files: requirements, design, tasks)
│   └── steering/       # 8 always-on architectural & engineering steering rules
├── mcp-server/         # Standalone TypeScript MCP server (plan_demo_cuts, validate_cut_plan)
├── public/ffmpeg/      # Self-hosted @ffmpeg/core 0.12.10 (ffmpeg-core.js + ffmpeg-core.wasm)
├── src/
│   ├── components/     # Stitcher's Lab UI (UploadZone, TimelineBar, ForgeWorkspace, ControlPanel, sampleGenerator)
│   ├── dsp/            # Pure 20 ms mono RMS silence detector (silenceDetector.ts)
│   ├── ffmpeg/         # Self-hosted FFmpeg.wasm filter_complex forger & MEMFS GC (forger.ts)
│   ├── planner/        # IEEE-754 exact energy-ranked segment planner (segmentPlanner.ts)
│   └── mediaGuardrails.ts
└── tests/              # Vitest + fast-check PBT + WASM/MEMFS hardening suites (33 tests)
```

---

## License

MIT
