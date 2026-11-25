# Spec 06 — MCP Stdio Server & Strict Zod Boundary Orchestration (`requirements.md`)

## Scope & Grounded Modules
- **MCP Entrypoint**: `mcp-server/src/index.ts` (`McpServer`, `StdioServerTransport`, `plan_demo_cuts`, `validate_cut_plan`)
- **Boundary Schemas**: `mcp-server/src/schemas.ts` (`MAX_VIDEO_DURATION_SEC = 3600`, `MAX_SEGMENTS = 500`, `demoSegmentSchema`, `cutRangeSchema`, `planDemoCutsSchema`, `validateCutPlanSchema`)
- **Microsecond Planner**: `mcp-server/src/plan.ts` (`mergeSegments`, `planCuts`, `validateCutPlan`, `toUs`, `toSec`)
- **Kiro Registration**: `.kiro/settings/mcp.json` (`mcpServers.stitchcut` -> `node mcp-server/dist/index.js`)
- **Verification Suite**: `mcp-server/src/plan.test.ts` (6 `node:test` unit + Zod boundary suites)

---

## EARS Requirements

### REQ-MCP-01 — Stdio Model Context Protocol Server Registration (Ubiquitous)
`mcp-server/src/index.ts` **shall** expose an `@modelcontextprotocol/sdk` `McpServer` (`stitchcut-mcp` v`0.1.0`) over `StdioServerTransport` compiled to `mcp-server/dist/index.js` and registered under `mcpServers.stitchcut` in `.kiro/settings/mcp.json` with zero network listeners or external API dependencies.

### REQ-MCP-02 — Strict Zod Boundary Validation Against Malformed Agent Inputs (Unwanted Behavior)
**If** an MCP client passes `NaN`, `+Infinity`, `-Infinity`, negative numbers, `videoDuration <= 0`, `videoDuration > 3600` (`MAX_VIDEO_DURATION_SEC`), `end < start`, or `segments.length > 500` (`MAX_SEGMENTS`) to `plan_demo_cuts` or `validate_cut_plan`, **then** `mcp-server/src/schemas.ts` **shall** reject the payload at the Zod schema boundary before planner execution.

### REQ-MCP-03 — Exact Integer-Microsecond Energy Planning (`plan_demo_cuts`) (Event-Driven)
**When** an agent invokes `plan_demo_cuts({ segments, videoDuration, targetBudgetSec })`, the server **shall** filter segments within `videoDuration`, quantize timestamps to integer microseconds (`toUs = Math.round(sec * 1e6)`), merge overlapping intervals keeping maximum segment energy, allocate `budgetUs` greedily by descending `energy` (tie-breaking by ascending `start`), trim any partially fitting boundary cut in exact integer microseconds, and return chronological `Cut[]` JSON.

### REQ-MCP-04 — Independent Cut Plan Auditing (`validate_cut_plan`) (Event-Driven)
**When** an agent invokes `validate_cut_plan({ segments, videoDuration, targetBudgetSec })`, `mcp-server/src/plan.ts` **shall** check non-negativity (`start >= 0`), positive span (`start < end`), upper bound (`end <= videoDuration`), chronological ordering, non-overlap (`seg.end <= next.start`), and budget adherence (`totalDuration <= targetBudgetSec + 1e-6`), returning `{ valid, totalDuration, errors }`.
