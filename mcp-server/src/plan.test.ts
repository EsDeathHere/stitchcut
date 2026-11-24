import assert from "node:assert/strict";
import test from "node:test";
import { mergeSegments, planCuts, validateCutPlan } from "./plan.js";
import {
  MAX_SEGMENTS,
  MAX_VIDEO_DURATION_SEC,
  planDemoCutsSchema,
  validateCutPlanSchema,
} from "./schemas.js";

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

test("MCP Zod schemas reject NaN, Infinity, negative durations, videoDuration > 3600, and > 500 segments", () => {
  const validPlanInput = {
    segments: [{ start: 0, end: 5, energy: 0.8 }],
    videoDuration: MAX_VIDEO_DURATION_SEC,
    targetBudgetSec: 60,
  };
  assert.equal(planDemoCutsSchema.safeParse(validPlanInput).success, true);

  const validValidateInput = {
    segments: Array.from({ length: MAX_SEGMENTS }, (_, i) => ({
      start: i,
      end: i + 0.5,
    })),
    videoDuration: MAX_VIDEO_DURATION_SEC,
    targetBudgetSec: 300,
  };
  assert.equal(validateCutPlanSchema.safeParse(validValidateInput).success, true);

  // Reject NaN and +/-Infinity
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(
      planDemoCutsSchema.safeParse({ ...validPlanInput, videoDuration: bad }).success,
      false,
    );
    assert.equal(
      planDemoCutsSchema.safeParse({ ...validPlanInput, targetBudgetSec: bad }).success,
      false,
    );
    assert.equal(
      planDemoCutsSchema.safeParse({
        ...validPlanInput,
        segments: [{ start: 0, end: 2, energy: bad }],
      }).success,
      false,
    );
    assert.equal(
      validateCutPlanSchema.safeParse({ ...validValidateInput, videoDuration: bad }).success,
      false,
    );
    assert.equal(
      validateCutPlanSchema.safeParse({
        ...validValidateInput,
        segments: [{ start: 0, end: bad }],
      }).success,
      false,
    );
  }

  // Reject negative or zero videoDuration, negative targetBudgetSec, negative segment duration (end < start)
  assert.equal(
    planDemoCutsSchema.safeParse({ ...validPlanInput, videoDuration: 0 }).success,
    false,
  );
  assert.equal(
    planDemoCutsSchema.safeParse({ ...validPlanInput, videoDuration: -10 }).success,
    false,
  );
  assert.equal(
    planDemoCutsSchema.safeParse({ ...validPlanInput, targetBudgetSec: -1 }).success,
    false,
  );
  assert.equal(
    planDemoCutsSchema.safeParse({
      ...validPlanInput,
      segments: [{ start: 8, end: 3, energy: 0.5 }],
    }).success,
    false,
  );
  assert.equal(
    validateCutPlanSchema.safeParse({
      ...validValidateInput,
      segments: [{ start: 5, end: 2 }],
    }).success,
    false,
  );

  // Reject videoDuration > 3600
  assert.equal(
    planDemoCutsSchema.safeParse({ ...validPlanInput, videoDuration: 3600.001 }).success,
    false,
  );
  assert.equal(
    validateCutPlanSchema.safeParse({ ...validValidateInput, videoDuration: 3601 }).success,
    false,
  );

  // Reject arrays exceeding 500 segments
  const tooManyPlanSegments = Array.from({ length: MAX_SEGMENTS + 1 }, (_, i) => ({
    start: i,
    end: i + 0.5,
    energy: 0.5,
  }));
  const tooManyCutSegments = Array.from({ length: MAX_SEGMENTS + 1 }, (_, i) => ({
    start: i,
    end: i + 0.5,
  }));
  assert.equal(
    planDemoCutsSchema.safeParse({ ...validPlanInput, segments: tooManyPlanSegments }).success,
    false,
  );
  assert.equal(
    validateCutPlanSchema.safeParse({
      ...validValidateInput,
      segments: tooManyCutSegments,
    }).success,
    false,
  );
});
