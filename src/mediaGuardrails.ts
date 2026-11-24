export const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB
export const MAX_VIDEO_DURATION_SEC = 600; // 10 minutes

export function validateMediaFileSize(
  file: Pick<File, 'name' | 'size'>,
): string | null {
  if (!Number.isFinite(file.size) || file.size < 0) {
    return `Invalid file size reported for "${file.name}".`;
  }
  if (file.size === 0) {
    return `File "${file.name}" is empty (0 bytes). Please choose a valid video recording.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return `File "${file.name}" is ${sizeMb} MB, which exceeds the 250 MB browser limit. StitchCut processes video entirely in client-side WebAssembly memory (MEMFS) — please trim or compress the recording below 250 MB to prevent browser Out-of-Memory crashes.`;
  }
  return null;
}

export function validateMediaDuration(
  durationSec: number,
  fileName: string,
): string | null {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return `Unable to determine a valid media duration for "${fileName}".`;
  }
  if (durationSec > MAX_VIDEO_DURATION_SEC) {
    const mins = Math.floor(durationSec / 60);
    const secs = Math.round(durationSec % 60);
    const formatted = `${mins}m ${secs.toString().padStart(2, '0')}s (${durationSec.toFixed(1)}s)`;
    return `Video "${fileName}" is ${formatted} long, exceeding the 600-second (10-minute) limit. StitchCut caps recordings at 10 minutes so WebAudio PCM decoding and FFmpeg.wasm never exceed safe browser memory limits.`;
  }
  return null;
}

/**
 * Lightweight pre-decode metadata probe using an off-DOM <video preload="metadata"> element.
 * Always revokes its temporary ObjectURL before resolving.
 * Returns finite duration in seconds if available, or null when container metadata omits duration
 * (e.g. MediaRecorder WebM streams or audio-only files, which are then checked after decodeAudioData).
 */
export function probeVideoDurationSec(
  file: Blob,
  timeoutMs = 3000,
): Promise<number | null> {
  if (
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return Promise.resolve(null);
  }

  return new Promise<number | null>((resolve) => {
    const tempUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;

    const finish = (duration: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      try {
        video.removeAttribute('src');
        video.load();
      } catch {
        // Ignore cleanup errors in non-browser DOM shims
      }
      URL.revokeObjectURL(tempUrl);
      resolve(duration);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const d = video.duration;
      finish(Number.isFinite(d) && d > 0 ? d : null);
    };
    video.onerror = () => finish(null);
    video.src = tempUrl;
  });
}
