---
inclusion: always
---

# Steering 04 — Client Media Bounds & MCP Zod Perimeter Guardrails

## Context
Both StitchCut entrypoints — the Browser Studio (`src/`) and the stdio MCP Server (`mcp-server/`) — accept untrusted external inputs (raw media files in the browser; LLM-generated JSON tool arguments over MCP).

## Mandatory Rules
1. **Browser Media Guardrails (`src/mediaGuardrails.ts` & `src/App.tsx`)**:
   - Enforce `MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024` (250 MB) and reject `0`-byte files **before** calling `file.arrayBuffer()`.
   - Enforce `MAX_VIDEO_DURATION_SEC = 600` (10 minutes) **twice**:
     1. Fast pre-decode container probe via `probeVideoDurationSec(file)`.
     2. Authoritative post-decode check via `validateMediaDuration(decoded.duration, file.name)` to catch WebM streams whose container header reports `Infinity` duration.
2. **MCP Server Zod v4 Schemas (`mcp-server/src/schemas.ts`)**:
   - Every numeric field on `plan_demo_cuts` and `validate_cut_plan` **must** use `.finite()` to reject `NaN`, `+Infinity`, and `-Infinity`.
   - Enforce `MAX_SEGMENTS = 500` on segment arrays, `MAX_VIDEO_DURATION_SEC = 3600` (`positive().max(3600)`) on `videoDuration`, `min(0)` on `targetBudgetSec` and `energy`, and `.refine((seg) => seg.end >= seg.start)` on all segment ranges.
   - Any schema modification must keep the adversarial test suite in `mcp-server/src/plan.test.ts` green.
