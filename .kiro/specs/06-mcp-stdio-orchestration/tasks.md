# Spec 06 — MCP Stdio Server & Strict Zod Boundary Orchestration (`tasks.md`)

## Implementation & Verification Checklist

- [x] **Task 6.1 — Define Strict Zod v4 Input Schemas (`mcp-server/src/schemas.ts`)**
  - Enforce `MAX_VIDEO_DURATION_SEC = 3600`, `MAX_SEGMENTS = 500`, `.finite()`, non-negative bounds, and `end >= start` refinements on `planDemoCutsSchema` and `validateCutPlanSchema`.
- [x] **Task 6.2 — Implement Integer-Microsecond Planner & Validator (`mcp-server/src/plan.ts`)**
  - Implement `mergeSegments`, `planCuts` (energy-descending, start-ascending tie-break, exact microsecond partial trim), and `validateCutPlan`.
- [x] **Task 6.3 — Expose MCP Stdio Tools (`mcp-server/src/index.ts`)**
  - Register `plan_demo_cuts` and `validate_cut_plan` on `McpServer` and connect `StdioServerTransport`.
- [x] **Task 6.4 — Register Kiro Workspace MCP Config (`.kiro/settings/mcp.json`)**
  - Configure `stitchcut` server command `node` with `args: ["mcp-server/dist/index.js"]`.
- [x] **Task 6.5 — Verify Planner & Adversarial Boundary Suite (`mcp-server/src/plan.test.ts`)**
  - Verify overlap merging, energy-ranked chronological budgeting, float-heavy determinism, multi-error validation reporting, clean plan acceptance, and rejection of `NaN`, `±Infinity`, negatives, `videoDuration > 3600`, and `> 500` segments (6/6 tests passing).
