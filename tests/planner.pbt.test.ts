import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { planCutSegments, validateCutPlan } from '../src/planner/segmentPlanner';
import type { AudioSegment } from '../src/types';

const timestamp = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: -1000, max: 4000 }).map((value) => value / 10) },
  { weight: 4, arbitrary: fc.double({ min: -100, max: 400, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(NaN, Infinity, -Infinity) },
);
const candidate = fc.record({
  start: timestamp,
  end: timestamp,
  energy: fc.oneof(fc.double({ min: -1, max: 1 }), fc.constant(Infinity)),
});

describe('planCutSegments', () => {
  it('preserves bounds, order, duration accounting, budget, and determinism', () => {
    fc.assert(
      fc.property(
        fc.array(candidate, { maxLength: 40 }),
        fc.oneof(
          fc.integer({ min: 0, max: 3000 }).map((value) => value / 10),
          fc.double({ min: 0, max: 300, noNaN: true }),
        ),
        fc.oneof(
          fc.integer({ min: 0, max: 3500 }).map((value) => value / 10),
          fc.double({ min: 0, max: 350, noNaN: true }),
        ),
        (segments, duration, budget) => {
          const plan = planCutSegments(segments, duration, budget);

          let previousEnd = 0;
          let actualDuration = 0;
          for (const { start, end, energy } of plan.segments) {
            expect(start).toBeGreaterThanOrEqual(previousEnd);
            expect(start).toBeLessThan(end);
            expect(end).toBeLessThanOrEqual(duration);
            expect(Number.isFinite(energy) && energy >= 0).toBe(true);
            actualDuration += end - start;
            previousEnd = end;
          }

          expect(plan.originalDuration).toBe(duration);
          expect(plan.forgedDuration).toBe(actualDuration);
          expect(plan.forgedDuration).toBeLessThanOrEqual(budget);
          expect(plan.forgedDuration).toBeLessThanOrEqual(duration);
          expect(plan.strippedDuration).toBe(duration - actualDuration);
          expect(plan.withinBudget).toBe(true);
          expect(validateCutPlan(plan, duration, budget)).toEqual({ valid: true, errors: [] });
          expect(planCutSegments(segments, duration, budget)).toEqual(plan);
          expect(planCutSegments([...segments].reverse(), duration, budget)).toEqual(plan);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('clamps candidates, drops invalid spans, and merges overlaps and touching boundaries', () => {
    const segments: AudioSegment[] = [
      { start: 4, end: 7, energy: 0.7 },
      { start: 9, end: 8, energy: 1 },
      { start: 1, end: 4, energy: 0.3 },
      { start: -2, end: 2, energy: 0.5 },
      { start: NaN, end: 8, energy: 1 },
      { start: 8, end: 12, energy: NaN },
    ];
    const original = structuredClone(segments);
    const plan = planCutSegments(segments, 10, 10);

    expect(plan.segments).toEqual([
      { start: 0, end: 7, energy: 0.5 },
      { start: 8, end: 10, energy: 0 },
    ]);
    expect(plan.forgedDuration).toBe(9);
    expect(plan.strippedDuration).toBe(1);
    expect(segments).toEqual(original);
  });

  it('trims by energy, breaks ties by earliest start, and returns chronological playback', () => {
    const plan = planCutSegments([
      { start: 12, end: 16, energy: 0.5 },
      { start: 1, end: 5, energy: 0.5 },
      { start: 7, end: 9, energy: 1 },
      { start: 5.5, end: 6, energy: 0.1 },
    ], 20, 4);

    expect(plan.segments).toEqual([
      { start: 1, end: 3, energy: 0.5 },
      { start: 7, end: 9, energy: 1 },
    ]);
    expect(plan.forgedDuration).toBe(4);
  });

  it('keeps the budget strict when a fractional endpoint rounds up', () => {
    const plan = planCutSegments([{ start: 1, end: 2, energy: 1 }], 2, 0.1);

    expect(plan.forgedDuration).toBeCloseTo(0.1, 15);
    expect(plan.forgedDuration).toBeLessThanOrEqual(0.1);
    expect(validateCutPlan(plan, 2, 0.1).valid).toBe(true);
  });

  it('preserves higher-energy cuts when summing in playback order rounds up', () => {
    const first = { start: 0, end: 0.4, energy: 0.5 };
    const quietest = { start: 1, end: 1.2, energy: 0.25 };
    const loudest = { start: 2, end: 2.6, energy: 1 };
    const plan = planCutSegments([first, quietest, loudest], 3, 1.2);

    expect(plan.segments[0]).toEqual(first);
    expect(plan.segments[1].end).toBeLessThan(quietest.end);
    expect(plan.segments[2]).toEqual(loudest);
    expect(plan.forgedDuration).toBeCloseTo(1.2, 15);
    expect(plan.forgedDuration).toBeLessThanOrEqual(1.2);
  });

  it('skips a trim that is smaller than the endpoint precision and tries the next segment', () => {
    const lateStart = 2 ** 52;
    const plan = planCutSegments([
      { start: 0, end: 0.5, energy: 0.5 },
      { start: lateStart, end: lateStart + 2, energy: 1 },
    ], lateStart + 2, 0.75);

    expect(plan.segments).toEqual([{ start: 0, end: 0.5, energy: 0.5 }]);
    expect(plan.forgedDuration).toBe(0.5);
  });

  it.each([0, -1, NaN])('uses an empty plan for a nonpositive or invalid budget (%s)', (budget) => {
    const plan = planCutSegments([{ start: 0, end: 1, energy: 1 }], 2, budget);

    expect(plan).toEqual({
      segments: [], originalDuration: 2, forgedDuration: 0, strippedDuration: 2, withinBudget: true,
    });
    expect(validateCutPlan(plan, 2, budget).valid).toBe(true);
  });
});

describe('validateCutPlan', () => {
  const first = { start: 1, end: 2, energy: 1 };
  const second = { start: 3, end: 4, energy: 0.5 };
  const plan = planCutSegments([first, second], 5, 2);

  it.each([
    { segments: [{ ...first, start: -1 }, second] },
    { segments: [first, { ...second, end: 6 }] },
    { segments: [first, { ...second, end: 3 }] },
    { segments: [second, first] },
    { segments: [first, { ...second, start: 1.5, end: 2.5 }] },
    { segments: [first, { ...second, energy: NaN }] },
    { originalDuration: 6 },
    { forgedDuration: 1.5 },
    { strippedDuration: 3.5 },
    { withinBudget: false },
  ])('rejects an invalid plan override %j', (override) => {
    expect(validateCutPlan({ ...plan, ...override }, 5, 2).valid).toBe(false);
  });

  it('rejects an over-budget plan even when the flag is false', () => {
    expect(validateCutPlan({ ...plan, withinBudget: false }, 5, 1).valid).toBe(false);
  });
});
