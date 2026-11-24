import type { AudioSegment, CutPlan } from '../types';

const DURATION_EPSILON = 1e-6;

function sourceDuration(duration: number): number {
  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
}

function timeBudget(budget: number): number {
  return budget > 0 ? budget : 0;
}

function segmentDuration(segment: AudioSegment): number {
  return segment.end - segment.start;
}

function totalDuration(segments: AudioSegment[]): number {
  return segments.reduce((total, segment) => total + segmentDuration(segment), 0);
}

function mergeSegments(segments: AudioSegment[], duration: number): AudioSegment[] {
  const sorted: AudioSegment[] = [];
  for (const segment of segments) {
    const start = Math.max(0, Math.min(duration, segment.start));
    const end = Math.max(0, Math.min(duration, segment.end));
    if (!(start < end)) continue;

    const energy = Number.isFinite(segment.energy) ? Math.max(0, segment.energy) : 0;
    sorted.push({ start, end, energy });
  }
  sorted.sort((a, b) => a.start - b.start || a.end - b.end || a.energy - b.energy);

  const merged: AudioSegment[] = [];
  let weightScale = 0;
  let totalWeight = 0;
  for (const segment of sorted) {
    const previous = merged.at(-1);
    const length = segmentDuration(segment);
    if (!previous || segment.start > previous.end) {
      merged.push(segment);
      weightScale = length;
      totalWeight = 1;
      continue;
    }

    // Average source energy estimates by their clamped durations, in units of the longest source.
    const scale = Math.max(weightScale, length);
    const weight = length / scale;
    totalWeight = totalWeight * (weightScale / scale) + weight;
    weightScale = scale;
    previous.energy += (segment.energy - previous.energy) * (weight / totalWeight);
    previous.end = Math.max(previous.end, segment.end);
  }
  return merged;
}

function lastFittingEnd(low: number, high: number, fits: (end: number) => boolean): number {
  // The lower endpoint fits and the upper endpoint exceeds the budget.
  while (true) {
    const mid = low + (high - low) / 2;
    if (mid === low || mid === high) return low;
    if (fits(mid)) low = mid;
    else high = mid;
  }
}

function selectByEnergy(ranked: AudioSegment[], limit: number): AudioSegment[] {
  const selected: AudioSegment[] = [];
  let used = 0;
  for (const segment of ranked) {
    if (used >= limit) break;

    const { start, end, energy } = segment;
    const length = segmentDuration(segment);
    if (used + length <= limit) {
      selected.push(segment);
      used += length;
      continue;
    }

    let trimmedEnd = Math.min(end, start + (limit - used));
    if (used + (trimmedEnd - start) > limit) {
      // An endpoint rounded up. Find the greatest representable endpoint that fits.
      trimmedEnd = lastFittingEnd(start, trimmedEnd, (candidate) => used + (candidate - start) <= limit);
    }

    if (trimmedEnd > start) {
      selected.push({ start, end: trimmedEnd, energy });
      used += trimmedEnd - start;
    }
  }
  return selected;
}

function correctPlaybackTotal(
  selectedByEnergy: AudioSegment[],
  playback: AudioSegment[],
  limit: number,
): AudioSegment[] {
  const rank = new Map(selectedByEnergy.map((segment, index) => [segment, index]));
  const prefix = (count: number) => playback.filter((segment) => (rank.get(segment) ?? Infinity) < count);

  // Adding nonnegative durations preserves monotonicity, even when their sum rounds.
  let low = 0;
  let high = selectedByEnergy.length;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (totalDuration(prefix(mid)) <= limit) low = mid;
    else high = mid;
  }

  const cutoff = selectedByEnergy[low];
  const corrected = prefix(low + 1);
  const index = corrected.indexOf(cutoff);
  const trimmed = { ...cutoff };
  corrected[index] = trimmed;
  trimmed.end = lastFittingEnd(cutoff.start, cutoff.end, (end) => {
    trimmed.end = end;
    return totalDuration(corrected) <= limit;
  });
  if (trimmed.end === trimmed.start) corrected.splice(index, 1);
  return corrected;
}

export function planCutSegments(
  segments: AudioSegment[],
  videoDuration: number,
  targetBudgetSec: number,
): CutPlan {
  const originalDuration = sourceDuration(videoDuration);
  const budget = timeBudget(targetBudgetSec);
  const limit = Math.min(originalDuration, budget);
  let planned = mergeSegments(segments, originalDuration);
  let forgedDuration = totalDuration(planned);

  if (forgedDuration > limit) {
    planned.sort((a, b) => b.energy - a.energy || a.start - b.start);
    const selectedByEnergy = selectByEnergy(planned, limit);
    planned = [...selectedByEnergy].sort((a, b) => a.start - b.start);
    forgedDuration = totalDuration(planned);

    // Changing summation order can round the chronological total above the limit.
    if (forgedDuration > limit) {
      planned = correctPlaybackTotal(selectedByEnergy, planned, limit);
      forgedDuration = totalDuration(planned);
    }
  }

  return {
    segments: planned,
    originalDuration,
    forgedDuration,
    strippedDuration: originalDuration - forgedDuration,
    withinBudget: forgedDuration <= budget,
  };
}

export function validateCutPlan(
  plan: CutPlan,
  videoDuration: number,
  targetBudgetSec: number,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const duration = sourceDuration(videoDuration);
  const budget = timeBudget(targetBudgetSec);
  let previousEnd = 0;

  for (const [index, { start, end, energy }] of plan.segments.entries()) {
    if (!(0 <= start && start < end && end <= duration)) {
      errors.push(`Segment ${index} has invalid bounds.`);
    }
    if (start < previousEnd) {
      errors.push(`Segment ${index} overlaps or precedes the previous segment.`);
    }
    if (!Number.isFinite(energy) || energy < 0) {
      errors.push(`Segment ${index} has invalid energy.`);
    }
    previousEnd = end;
  }

  const actualDuration = totalDuration(plan.segments);
  const { originalDuration, forgedDuration, strippedDuration, withinBudget } = plan;
  if (originalDuration !== duration) {
    errors.push('Original duration does not match the video duration.');
  }
  if (!(0 <= forgedDuration && forgedDuration <= duration &&
    Math.abs(forgedDuration - actualDuration) <= DURATION_EPSILON)) {
    errors.push('Forged duration does not match the total segment duration.');
  }
  if (!(0 <= strippedDuration && strippedDuration <= duration &&
    Math.abs(strippedDuration - (duration - forgedDuration)) <= DURATION_EPSILON)) {
    errors.push('Stripped duration does not match the removed duration.');
  }

  const fitsBudget = actualDuration <= budget && forgedDuration <= budget;
  if (!fitsBudget) errors.push('Cut plan exceeds the time budget.');
  if (withinBudget !== fitsBudget) errors.push('Budget flag does not match the cut plan.');

  return { valid: errors.length === 0, errors };
}
