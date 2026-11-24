export type Segment = { start: number; end: number; energy: number };
export type Cut = { start: number; end: number; energy: number; duration: number };

export type CutPlan = {
  segments: Cut[];
  totalDuration: number;
  targetBudgetSec: number;
};

export type ValidationResult = {
  valid: boolean;
  totalDuration: number;
  errors: string[];
};

const EPS = 1e-6;

/** Seconds -> integer microseconds. All math below is integer, so budget sums are exact. */
const toUs = (sec: number): number => Math.round(sec * 1e6);
const toSec = (us: number): number => us / 1e6;

type UsSegment = { start: number; end: number; energy: number };

/** Sorts and merges overlapping segments; merged energy is the max of its parts. */
export function mergeSegments(segments: Segment[]): Segment[] {
  const sorted: UsSegment[] = segments
    .map((s) => ({ start: toUs(s.start), end: toUs(s.end), energy: s.energy }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: UsSegment[] = [];
  for (const seg of sorted) {
    const last = merged[merged.length - 1];
    if (last && seg.start < last.end) {
      last.end = Math.max(last.end, seg.end);
      last.energy = Math.max(last.energy, seg.energy);
    } else {
      merged.push({ ...seg });
    }
  }
  return merged.map((s) => ({ start: toSec(s.start), end: toSec(s.end), energy: s.energy }));
}

/**
 * Builds a cut plan under targetBudgetSec, keeping the highest-energy material first.
 * Overlaps are merged, output is chronological, and a segment that only partly fits is trimmed.
 */
export function planCuts(segments: Segment[], targetBudgetSec: number): CutPlan {
  const merged: UsSegment[] = mergeSegments(segments).map((s) => ({
    start: toUs(s.start),
    end: toUs(s.end),
    energy: s.energy,
  }));

  // Ranked by energy (desc), then start (asc) for determinism.
  const ranked = [...merged].sort((a, b) => b.energy - a.energy || a.start - b.start);
  const budgetUs = Math.round(targetBudgetSec * 1e6);

  const picked: UsSegment[] = [];
  let totalUs = 0;
  for (const seg of ranked) {
    const remaining = budgetUs - totalUs;
    if (remaining <= 0) break;
    const duration = seg.end - seg.start;
    if (duration <= remaining) {
      picked.push(seg);
      totalUs += duration;
    } else {
      picked.push({ ...seg, end: seg.start + remaining });
      totalUs = budgetUs;
      break;
    }
  }

  picked.sort((a, b) => a.start - b.start);
  const cuts: Cut[] = picked.map((s) => ({
    start: toSec(s.start),
    end: toSec(s.end),
    energy: s.energy,
    duration: toSec(s.end - s.start),
  }));

  return {
    segments: cuts,
    totalDuration: toSec(totalUs),
    targetBudgetSec,
  };
}

export function validateCutPlan(
  segments: { start: number; end: number }[],
  videoDuration: number,
  targetBudgetSec: number,
): ValidationResult {
  const errors: string[] = [];
  let totalDuration = 0;

  segments.forEach((seg, i) => {
    if (!(seg.start >= 0)) errors.push(`segment[${i}]: start must be >= 0 (got ${seg.start})`);
    if (!(seg.start < seg.end)) {
      errors.push(`segment[${i}]: start must be < end (got ${seg.start}..${seg.end})`);
    }
    if (!(seg.end <= videoDuration)) {
      errors.push(`segment[${i}]: end must be <= videoDuration (got ${seg.end} > ${videoDuration})`);
    }
    const next = segments[i + 1];
    if (next && next.start < seg.start) {
      errors.push(`segment[${i}]: not chronological (next.start ${next.start} < ${seg.start})`);
    }
    if (next && !(seg.end <= next.start)) {
      errors.push(
        `segment[${i}]: end must be <= next.start (got ${seg.end} > ${next.start})`,
      );
    }
    totalDuration += seg.end - seg.start;
  });

  if (!(totalDuration <= targetBudgetSec + EPS)) {
    errors.push(
      `total duration ${totalDuration} exceeds targetBudgetSec ${targetBudgetSec} (+${EPS})`,
    );
  }

  return { valid: errors.length === 0, totalDuration, errors };
}
