# Spec 02 — Deterministic Segment Planner & PBT Invariants (`requirements.md`)

## Scope & Grounded Modules
- **Implementation**: `src/planner/segmentPlanner.ts` (`planCutSegments`, `validateCutPlan`, `DURATION_EPSILON = 1e-6`)
- **Shared Contracts**: `src/types.ts` (`AudioSegment`, `CutPlan`)
- **Verification Suite**: `tests/planner.pbt.test.ts` (20 Vitest suites including 1,000-run `fast-check` property suite)

---

## EARS Requirements

### REQ-PLN-01 — Input Sanitization, Clamping & Touching-Span Merge (Event-Driven)
**When** `planCutSegments(segments, videoDuration, targetBudgetSec)` is called with arbitrary candidate `AudioSegment[]`, the system **shall**:
1. Normalize `originalDuration = Number.isFinite(videoDuration) ? Math.max(0, videoDuration) : 0` and `budget = targetBudgetSec > 0 ? targetBudgetSec : 0`.
2. Clamp every candidate's `start` and `end` into `[0, originalDuration]`, discard degenerate or `NaN` spans where `!(start < end)`, sanitize non-finite or negative `energy` to `0`, and never mutate the caller's input array.
3. Sort chronologically and merge overlapping or touching spans (`segment.start <= previous.end`), combining `energy` via duration-weighted running mean scaled by `Math.max(weightScale, length)` to prevent floating-point overflow.

### REQ-PLN-02 — Energy-Ranked Selection with Earliest-Start Tie-Breaking (State-Driven)
**While** the merged active duration exceeds `limit = Math.min(originalDuration, budget)`, the system **shall** rank merged segments by descending `energy` (`b.energy - a.energy`) with deterministic earliest-start tie-breaking (`a.start - b.start`), greedily retain full segments that fit within remaining budget, trimmed-end-cap the boundary segment if partial budget remains, and re-sort retained segments into strict chronological playback order (`a.start - b.start`).

### REQ-PLN-03 — IEEE-754 Summation Order & Binary-Search Endpoint Exactness (Unwanted Behavior)
**If** floating-point rounding causes either `used + (trimmedEnd - start) > limit` during greedy trim or causes the chronological playback sum `totalDuration(planned)` to exceed `limit` after re-ordering, **then** `lastFittingEnd` and `correctPlaybackTotal` **shall** binary-search IEEE-754 representable endpoints to guarantee `forgedDuration <= limit` without sacrificing higher-energy segments.

### REQ-PLN-04 — Exhaustive `CutPlan` Invariant Validator (Ubiquitous)
`validateCutPlan(plan, videoDuration, targetBudgetSec)` **shall** verify and report structured errors for all five mathematical invariants:
1. **Segment Bounds**: `0 <= start < end <= duration` and finite `energy >= 0` for all segments.
2. **Chronological Non-Overlap**: `previousEnd <= start` for all consecutive segments.
3. **Duration Conservation**: `forgedDuration` matches `sum(end - start)` within `DURATION_EPSILON` (`1e-6`), and `strippedDuration` matches `duration - forgedDuration` within `1e-6`.
4. **Strict Budget Compliance**: `actualDuration <= budget && forgedDuration <= budget`.
5. **Order-Independent Determinism**: `planCutSegments(segments, d, b)` equals `planCutSegments([...segments].reverse(), d, b)`.
