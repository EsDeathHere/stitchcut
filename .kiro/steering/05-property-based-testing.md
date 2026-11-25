---
inclusion: always
---

# Steering 05 — Property-Based Testing (`fast-check`) Invariants

## Context
Floating-point interval arithmetic is notorious for subtle off-by-1-ULP bugs: partial trims rounding above `targetBudgetSec`, non-associative summation when re-sorting from energy rank back to chronological order, and `NaN` propagation. Example-based unit tests alone are insufficient.

## Mandatory Rules
1. **Five Non-Negotiable `CutPlan` Invariants (`src/planner/segmentPlanner.ts`)**:
   Every output of `planCutSegments(segments, videoDuration, targetBudgetSec)` must satisfy:
   - **Bounds**: `0 <= start < end <= originalDuration` and `Number.isFinite(energy) && energy >= 0`.
   - **Strict Chronological Non-Overlap**: `segments[i].end <= segments[i + 1].start` for all `i`.
   - **Duration Conservation**: `forgedDuration === sum(end - start)` (within `1e-6`) and `strippedDuration === originalDuration - forgedDuration`.
   - **Exact Budget Ceiling**: `forgedDuration <= Math.min(originalDuration, Math.max(0, targetBudgetSec))` with zero ULP overshoot (`withinBudget === true`).
   - **Order-Independent Determinism**: Identical outputs across repeated calls and reversed candidate orderings (`[...segments].reverse()`).
2. **Minimum 1,000+ PBT Iteration Gate**:
   - `tests/planner.pbt.test.ts` must maintain `{ numRuns: 1000 }` over adversarial `fast-check` arbitraries (including `NaN`, `±Infinity`, negative timestamps, and inverted spans), complemented by `{ numRuns: 100 }` randomized DSP padding/silence runs in `tests/silenceDetector.test.ts`.
   - Never lower `numRuns` or weaken assertions in `validateCutPlan` to mask rounding regressions; use IEEE-754 endpoint bisection (`lastFittingEnd` / `correctPlaybackTotal`) instead.
