# StitchCut — Architecture Steering Rules

These rules are mandatory for all contributions and agent-generated code in **StitchCut**.

## 1. Strict Zero-Server Privacy
- **NO** backend servers, cloud storage uploads, external transcoding APIs, or telemetry endpoints.
- All video demuxing, audio analysis, cut planning, and MP4 forging **MUST** execute 100% locally in the browser (Web Audio API + FFmpeg.wasm).
- Never `fetch()` user media to any external origin.

## 2. Mandatory Cross-Origin Isolation (COOP/COEP)
- `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` **MUST** remain configured in both `vite.config.ts` (`server.headers` and `preview.headers`) and `vercel.json`.
- `@ffmpeg/ffmpeg` and `@ffmpeg/util` **MUST** stay in `optimizeDeps.exclude` in `vite.config.ts`.
- Any external asset loaded by the app must be CORP-compatible or bundled locally so COEP never blocks it.

## 3. Pure, Deterministic DSP & Planner Modules
- `src/dsp/**` and `src/planner/**` **MUST** remain pure and deterministic:
  - No `Math.random()`, `Date.now()`, network calls, DOM access, or global mutable state.
  - Identical inputs must always yield deeply identical outputs.
- All shared data structures must import from `src/types.ts` without breaking exported contract shapes.

## 4. Property-Based Testing (PBT) Gate
- Every invariant in `validateCutPlan` must be verified with `fast-check` under Vitest (`npm test`).
- Saving changes under `src/dsp/**` or `src/planner/**` triggers `.kiro/hooks/pbt-on-save.json` (`npm test`).
- No PR or branch may be merged if `npm test` or `npm run build` fails.

## 5. Kiro Directory Integrity
- **NEVER** add `.kiro/` to `.gitignore`. Specs, steering docs, hooks, and MCP settings are first-class project artifacts committed to `main`.
