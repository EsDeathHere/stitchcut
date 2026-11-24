import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { detectActiveSegments } from '../src/dsp/silenceDetector';
import type { SilenceConfig } from '../src/types';

const sampleRate = 1000;
const windowSize = 20;
const config: SilenceConfig = {
  silenceThresholdDb: -30,
  minSilenceDurationSec: 0.04,
  preRollMs: 0,
  postRollMs: 0,
  targetBudgetSec: 1,
};

function audioBuffer(...channels: Float32Array[]): AudioBuffer {
  const length = channels[0].length;
  return {
    sampleRate,
    length,
    duration: length / sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[channel],
  } as AudioBuffer;
}

function samples(...amplitudes: number[]): Float32Array {
  return Float32Array.from({ length: amplitudes.length * windowSize }, (_, index) =>
    amplitudes[Math.floor(index / windowSize)],
  );
}

describe('detectActiveSegments', () => {
  it('keeps short pauses and removes below-threshold runs at the minimum duration', () => {
    const input = audioBuffer(samples(0, 0, 0.5, 0, 1, 0, 0, 0.25, 0, 0));
    const segments = detectActiveSegments(input, config);

    expect(segments.map(({ start, end }) => [start, end])).toEqual([[0.04, 0.1], [0.14, 0.16]]);
    expect(segments[0].energy).toBeCloseTo(0.5);
    expect(segments[1].energy).toBeCloseTo(0.25);
  });

  it('downmixes channels sample by sample before taking RMS', () => {
    const input = audioBuffer(samples(0.5, 0.5, 0.75), samples(-0.5, -0.5, -0.25));

    expect(detectActiveSegments(input, config)).toEqual([{ start: 0.04, end: 0.06, energy: 0.25 }]);
  });

  it('weights RMS by the portion of each window included by padding', () => {
    const input = audioBuffer(samples(0, 0, 1, 0, 0));
    const [segment] = detectActiveSegments(input, { ...config, preRollMs: 10, postRollMs: 5 });

    expect(segment.start).toBeCloseTo(0.03, 12);
    expect(segment.end).toBeCloseTo(0.065, 12);
    expect(segment.energy).toBeCloseTo(20 / 35, 12);
  });

  it('clamps padding to the clip and coalesces padded overlaps', () => {
    const input = audioBuffer(samples(0.5, 0, 0, 1));
    const segments = detectActiveSegments(input, { ...config, preRollMs: 25, postRollMs: 25 });

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ start: 0, end: 0.08 });
    expect(segments[0].energy).toBeCloseTo(0.375);
  });

  it('uses the actual length of the final partial window', () => {
    const pcm = new Float32Array(65);
    pcm.fill(0.5, 60);

    expect(detectActiveSegments(audioBuffer(pcm), config)).toEqual([
      { start: 0.06, end: 0.065, energy: 0.5 },
    ]);
  });

  it('returns no segments for empty audio or digital silence shorter than the minimum', () => {
    expect(detectActiveSegments(audioBuffer(samples()), config)).toEqual([]);
    expect(detectActiveSegments(audioBuffer(samples(0)), config)).toEqual([]);
  });

  it('keeps a known speech burst with randomized silence lengths and roll padding', () => {
    fc.assert(fc.property(
      fc.integer({ min: 2, max: 15 }),
      fc.integer({ min: 1, max: 15 }),
      fc.integer({ min: 2, max: 15 }),
      fc.integer({ min: 0, max: 350 }),
      fc.integer({ min: 0, max: 350 }),
      (leading, active, trailing, preRollMs, postRollMs) => {
        const pcm = new Float32Array((leading + active + trailing) * windowSize);
        pcm.fill(0.5, leading * windowSize, (leading + active) * windowSize);
        const input = audioBuffer(pcm);
        const settings = { ...config, preRollMs, postRollMs };
        const segments = detectActiveSegments(input, settings);
        const start = Math.max(0, leading * windowSize - preRollMs);
        const end = Math.min(pcm.length, (leading + active) * windowSize + postRollMs);

        expect(segments).toHaveLength(1);
        expect(segments[0].start).toBeCloseTo(start / sampleRate, 12);
        expect(segments[0].end).toBeCloseTo(end / sampleRate, 12);
        expect(segments[0].energy).toBeCloseTo(0.5 * active * windowSize / (end - start), 12);
        expect(detectActiveSegments(input, settings)).toEqual(segments);
      },
    ), { numRuns: 100 });
  });
});
