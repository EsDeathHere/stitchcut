import assert from "node:assert/strict";
import test from "node:test";
import { mergeSegments, planCuts, validateCutPlan } from "./plan.js";

test("mergeSegments merges overlaps and keeps max energy", () => {
  const merged = mergeSegments([
    { start: 5, end: 8, energy: 0.2 },
    { start: 0, end: 3, energy: 0.4 },
    { start: 2, end: 4, energy: 0.9 },
  ]);
  assert.deepEqual(merged, [
    { start: 0, end: 4, energy: 0.9 },
    { start: 5, end: 8, energy: 0.2 },
  ]);
});

test("planCuts spends the budget on highest energy, chronologically", () => {
  const plan = planCuts(
    [
      { start: 0, end: 10, energy: 0.1 },
      { start: 12, end: 20, energy: 0.9 },
      { start: 25, end: 30, energy: 0.5 },
    ],
    10,
  );
  assert.deepEqual(
    plan.segments.map((s) => [s.start, s.end]),
    [
      [12, 20],
      [25, 27],
    ],
  );
  assert.equal(plan.totalDuration, 10);
  assert.equal(validateCutPlan(plan.segments, 30, 10).valid, true);
});

test("planCuts is deterministic under float-heavy input", () => {
  const plan = planCuts(
    [
      { start: 0.1, end: 0.2, energy: 0.3 },
      { start: 0.2, end: 0.4, energy: 0.7 },
    ],
    0.3,
  );
  assert.equal(plan.totalDuration <= 0.3 + 1e-6, true);
  assert.equal(validateCutPlan(plan.segments, 1, 0.3).valid, true);
});

test("validateCutPlan reports overlaps, bounds and budget", () => {
  const res = validateCutPlan(
    [
      { start: 0, end: 6 },
      { start: 5, end: 11 },
    ],
    10,
    5,
  );
  assert.equal(res.valid, false);
  assert.equal(res.errors.length, 3);
  assert.equal(res.totalDuration, 12);
});

test("validateCutPlan accepts a clean plan", () => {
  assert.deepEqual(validateCutPlan([{ start: 0, end: 2 }], 10, 2), {
    valid: true,
    totalDuration: 2,
    errors: [],
  });
});
