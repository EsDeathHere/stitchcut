# Spec 02 — Deterministic Segment Planner & PBT Invariants (`tasks.md`)

## Implementation & Verification Checklist

- [x] **Task 2.1 — Implement Segment Sanitization & Weighted Merge (`src/planner/segmentPlanner.ts`)**
  - Clamp segment endpoints to `[0, originalDuration]`, drop `NaN` or empty spans, clamp negative/non-finite energy to `0`, and avoid mutating input arrays.
  - Merge overlapping and touching (`start <= previous.end`) intervals with scale-normalized duration-weighted energy averaging.
- [x] **Task 2.2 — Implement Energy-Prioritized Budget Selection (`src/planner/segmentPlanner.ts`)**
  - Rank segments by `b.energy - a.energy || a.start - b.start`.
  - Implement `selectByEnergy` with `lastFittingEnd` IEEE-754 bisection for exact partial-segment trimming.
  - Implement `correctPlaybackTotal` to prevent chronological re-summation rounding from exceeding `limit`.
- [x] **Task 2.3 — Implement `validateCutPlan` Invariant Checker (`src/planner/segmentPlanner.ts`)**
  - Validate bounds, chronological non-overlap, finite non-negative energy, `forgedDuration` and `strippedDuration` conservation within `DURATION_EPSILON = 1e-6`, and `withinBudget` flag accuracy.
- [x] **Task 2.4 — Build 1,000-Run `fast-check` PBT & Edge-Case Suite (`tests/planner.pbt.test.ts`)**
  - Verify 1,000 adversarial `fast-check` runs including `NaN`, `±Infinity`, negative bounds, and reversed-input determinism.
  - Verify `2 ** 52` ULP precision edge cases, fractional `0.1` rounding, non-associative playback summation, and `validateCutPlan` negative override cases (20 total test cases).
