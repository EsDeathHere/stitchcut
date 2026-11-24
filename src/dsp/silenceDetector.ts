import type { AudioSegment, SilenceConfig } from '../types';

/**
 * Detects active (non-silent) audio segments from a decoded Web Audio buffer.
 * Stub implementation — full DSP logic will be implemented on its dedicated branch.
 */
export function detectActiveSegments(
  _audioBuffer: AudioBuffer,
  _config: SilenceConfig,
): AudioSegment[] {
  return [];
}
