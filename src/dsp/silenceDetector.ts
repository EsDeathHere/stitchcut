import type { AudioSegment, SilenceConfig } from '../types';

const WINDOW_DURATION_SEC = 0.02;

export function detectActiveSegments(
  audioBuffer: AudioBuffer,
  config: SilenceConfig,
): AudioSegment[] {
  const { duration, length, numberOfChannels, sampleRate } = audioBuffer;
  if (length === 0 || duration === 0 || numberOfChannels === 0) return [];

  const windowSize = Math.max(1, Math.round(sampleRate * WINDOW_DURATION_SEC));
  const channels = Array.from({ length: numberOfChannels }, (_, channel) =>
    audioBuffer.getChannelData(channel),
  );
  const rmsByWindow = new Float64Array(Math.ceil(length / windowSize));
  const windowSample = (index: number) => Math.min(index * windowSize, length);
  const windowTime = (index: number) => windowSample(index) / sampleRate;
  let hasSignal = false;

  for (let index = 0; index < rmsByWindow.length; index++) {
    const start = windowSample(index);
    const end = windowSample(index + 1);
    let sumOfSquares = 0;
    for (let sample = start; sample < end; sample++) {
      let channelSum = 0;
      for (const channel of channels) channelSum += channel[sample];
      const mono = channelSum / numberOfChannels;
      sumOfSquares += mono * mono;
    }
    const rms = Math.sqrt(sumOfSquares / (end - start));
    rmsByWindow[index] = rms;
    hasSignal ||= rms > 0;
  }

  if (!hasSignal) return [];

  const segments: AudioSegment[] = [];
  const preRoll = Math.max(0, config.preRollMs) / 1000;
  const postRoll = Math.max(0, config.postRollMs) / 1000;
  function addActiveRange(firstWindow: number, nextWindow: number) {
    if (firstWindow === nextWindow) return;

    const start = Math.max(0, windowTime(firstWindow) - preRoll);
    const end = Math.min(duration, windowTime(nextWindow) + postRoll);
    const previous = segments.at(-1);
    if (previous && start <= previous.end) {
      previous.end = Math.max(previous.end, end);
    } else {
      segments.push({ start, end, energy: 0 });
    }
  }

  let activeStart = 0;
  let silenceStart = 0;
  for (let index = 0; index <= rmsByWindow.length; index++) {
    if (index < rmsByWindow.length) {
      const db = 20 * Math.log10(rmsByWindow[index] + 1e-10);
      if (db < config.silenceThresholdDb) continue;
    }

    const quietSamples = windowSample(index) - windowSample(silenceStart);
    if (quietSamples > 0 && quietSamples / sampleRate >= config.minSilenceDurationSec) {
      addActiveRange(activeStart, silenceStart);
      activeStart = index;
    }
    silenceStart = index + 1;
  }
  addActiveRange(activeStart, rmsByWindow.length);

  for (const segment of segments) {
    // Weight each window's RMS by the time included after padding.
    const firstWindow = Math.max(0, Math.ceil(segment.start * sampleRate / windowSize) - 1);
    let weightedRms = 0;
    for (let index = firstWindow; index < rmsByWindow.length; index++) {
      const start = windowTime(index);
      if (start >= segment.end) break;
      const overlap = Math.min(segment.end, windowTime(index + 1)) - Math.max(segment.start, start);
      weightedRms += rmsByWindow[index] * Math.max(0, overlap);
    }
    segment.energy = weightedRms / (segment.end - segment.start);
  }

  return segments;
}
