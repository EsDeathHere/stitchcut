import type { FFmpeg } from '@ffmpeg/ffmpeg';
import type { AudioSegment, ForgeProgress } from '../types';

const CORE_VERSION = '0.12.10';
const CORE_BASE_URL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(
  onProgress: (p: ForgeProgress) => void,
): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }

  if (loadPromise) {
    onProgress({
      stage: 'loading',
      percent: 12,
      message: 'Waiting for FFmpeg.wasm engine to finish initializing...',
    });
    return loadPromise;
  }

  loadPromise = (async () => {
    onProgress({
      stage: 'loading',
      percent: 5,
      message: 'Importing @ffmpeg/ffmpeg and @ffmpeg/util modules...',
    });

    const [{ FFmpeg: FFmpegClass }, { toBlobURL }] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/util'),
    ]);

    const ffmpeg = new FFmpegClass();

    onProgress({
      stage: 'loading',
      percent: 12,
      message: 'Fetching FFmpeg WebAssembly core via blob URLs...',
    });

    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    ]);

    onProgress({
      stage: 'loading',
      percent: 20,
      message: 'Booting FFmpeg.wasm worker...',
    });

    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null;
    ffmpegInstance = null;
    throw err;
  }
}

function getInputExtension(file: File | Blob): string {
  if (file instanceof File && file.name.includes('.')) {
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (ext) return ext;
  }
  const mime = file.type.toLowerCase();
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('x-matroska') || mime.includes('mkv')) return 'mkv';
  return 'mp4';
}

/**
 * Builds an FFmpeg filter_complex graph that trims video & audio streams
 * for each planned segment and concatenates them into [outv][outa].
 */
export function buildFilterComplex(segments: AudioSegment[]): string {
  const parts: string[] = [];
  const concatInputs: string[] = [];

  segments.forEach((seg, index) => {
    const start = Math.max(0, seg.start).toFixed(3);
    const end = Math.max(seg.start, seg.end).toFixed(3);
    parts.push(
      `[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${index}]`,
    );
    parts.push(
      `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${index}]`,
    );
    concatInputs.push(`[v${index}][a${index}]`);
  });

  parts.push(
    `${concatInputs.join('')}concat=n=${segments.length}:v=1:a=1[outv][outa]`,
  );

  return parts.join(';');
}

/**
 * Stitches planned audio/video segments from a source video into a single
 * browser-memory `.mp4` Blob using FFmpeg.wasm filter_complex.
 */
export async function forgeVideo(
  file: File | Blob,
  segments: AudioSegment[],
  onProgress: (p: ForgeProgress) => void,
): Promise<Blob> {
  if (segments.length === 0) {
    const msg = 'No active segments provided to forge.';
    onProgress({ stage: 'error', percent: 0, message: msg });
    throw new Error(msg);
  }

  let ffmpeg: FFmpeg;
  try {
    ffmpeg = await getFFmpeg(onProgress);
  } catch (err) {
    const message =
      err instanceof Error
        ? `Failed to load FFmpeg.wasm: ${err.message}`
        : 'Failed to load FFmpeg.wasm.';
    onProgress({ stage: 'error', percent: 0, message });
    throw new Error(message);
  }

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ext = getInputExtension(file);
  const inputName = `input-${runId}.${ext}`;
  const outputName = `forged-${runId}.mp4`;

  const recentLogs: string[] = [];

  const handleLog = ({ message }: { type: string; message: string }) => {
    if (message.trim()) {
      recentLogs.push(message.trim());
      if (recentLogs.length > 20) {
        recentLogs.shift();
      }
    }
  };

  const handleProgress = ({ progress }: { progress: number; time: number }) => {
    const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
    const percent = Math.min(95, 28 + Math.round(clamped * 67));
    onProgress({
      stage: 'forging',
      percent,
      message: `Stitching ${segments.length} segment${segments.length === 1 ? '' : 's'}... (${Math.round(clamped * 100)}%)`,
    });
  };

  ffmpeg.on('log', handleLog);
  ffmpeg.on('progress', handleProgress);

  try {
    onProgress({
      stage: 'forging',
      percent: 24,
      message: 'Writing source media into FFmpeg virtual filesystem...',
    });

    const inputBytes = new Uint8Array(await file.arrayBuffer());
    await ffmpeg.writeFile(inputName, inputBytes);

    const filterComplex = buildFilterComplex(segments);

    onProgress({
      stage: 'forging',
      percent: 28,
      message: `Running filter_complex (${segments.length} segment${segments.length === 1 ? '' : 's'})...`,
    });

    const exitCode = await ffmpeg.exec([
      '-i',
      inputName,
      '-filter_complex',
      filterComplex,
      '-map',
      '[outv]',
      '-map',
      '[outa]',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputName,
    ]);

    if (exitCode !== 0) {
      const tail = recentLogs.slice(-4).join(' | ');
      throw new Error(
        `FFmpeg exited with code ${exitCode}${tail ? `: ${tail}` : ''}`,
      );
    }

    onProgress({
      stage: 'forging',
      percent: 97,
      message: 'Reading forged MP4 from memory...',
    });

    const rawOutput = await ffmpeg.readFile(outputName);
    if (typeof rawOutput === 'string') {
      throw new Error('Unexpected string output from FFmpeg filesystem.');
    }

    // Copy into a standard ArrayBuffer-backed Uint8Array for strict BlobPart compatibility
    const copy = new Uint8Array(rawOutput.byteLength);
    copy.set(rawOutput);
    const blob = new Blob([copy], { type: 'video/mp4' });

    onProgress({
      stage: 'done',
      percent: 100,
      message: `Forged ${segments.length} segment${segments.length === 1 ? '' : 's'} into ${(blob.size / (1024 * 1024)).toFixed(2)} MB MP4.`,
    });

    return blob;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error during video forging.';
    onProgress({ stage: 'error', percent: 0, message });
    throw err;
  } finally {
    ffmpeg.off('log', handleLog);
    ffmpeg.off('progress', handleProgress);
    await Promise.allSettled([
      ffmpeg.deleteFile(inputName),
      ffmpeg.deleteFile(outputName),
    ]);
  }
}
