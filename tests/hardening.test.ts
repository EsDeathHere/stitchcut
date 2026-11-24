import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FFMPEG_CORE_JS_URL,
  FFMPEG_CORE_WASM_URL,
  __setForgerDepsForTests,
  buildFFmpegArgs,
  forgeVideo,
  isForgeInProgress,
} from '../src/ffmpeg/forger';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_VIDEO_DURATION_SEC,
  validateMediaDuration,
  validateMediaFileSize,
} from '../src/mediaGuardrails';

describe('FFmpeg self-hosting & WASM encoding hardening', () => {
  afterEach(() => {
    __setForgerDepsForTests(null);
  });

  it('uses strictly local same-origin paths for FFmpeg core assets (zero external CDN)', () => {
    expect(FFMPEG_CORE_JS_URL).toBe('/ffmpeg/ffmpeg-core.js');
    expect(FFMPEG_CORE_WASM_URL).toBe('/ffmpeg/ffmpeg-core.wasm');
    expect(FFMPEG_CORE_JS_URL).not.toMatch(/unpkg|jsdelivr|https?:/i);
    expect(FFMPEG_CORE_WASM_URL).not.toMatch(/unpkg|jsdelivr|https?:/i);
  });

  it('builds fast H.264/AAC encoding arguments with ultrafast preset and +faststart', () => {
    const args = buildFFmpegArgs('in.mp4', '[0:v]trim=0:1[outv]', 'out.mp4');
    const joined = args.join(' ');
    expect(joined).toContain('-c:v libx264');
    expect(joined).toContain('-preset ultrafast');
    expect(joined).toContain('-crf 23');
    expect(joined).toContain('-c:a aac');
    expect(joined).toContain('-movflags +faststart');
  });

  it('cleans up MEMFS input, intermediate, and output files in finally even when deleteFile or exec fails', async () => {
    const deleted: string[] = [];
    const mockFFmpeg = {
      on: vi.fn(),
      off: vi.fn(),
      writeFile: vi.fn(async () => true),
      exec: vi.fn(async () => 1), // simulate failure
      readFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
      listDir: vi.fn(async () => [
        { name: '.', isDir: true },
        { name: 'pass-0.mbtree', isDir: false },
      ]),
      deleteFile: vi.fn(async (name: string) => {
        deleted.push(name);
        if (name.startsWith('forged-')) {
          throw new Error('MEMFS file does not exist');
        }
        return true;
      }),
    } as unknown as FFmpeg;

    __setForgerDepsForTests({
      loadFFmpeg: async () => mockFFmpeg,
    });

    const inputBlob = new Blob([new Uint8Array([0, 1, 2, 3])], {
      type: 'video/mp4',
    });

    await expect(
      forgeVideo(inputBlob, [{ start: 0, end: 1, energy: 0.8 }], () => {}),
    ).rejects.toThrow(/FFmpeg exited with code 1/);

    expect(deleted.some((f) => f.startsWith('input-'))).toBe(true);
    expect(deleted.some((f) => f.startsWith('forged-'))).toBe(true);
    expect(deleted).toContain('pass-0.mbtree');
    expect(isForgeInProgress()).toBe(false);
  });

  it('enforces a concurrency lock so overlapping forgeVideo calls are rejected', async () => {
    let releaseExec!: (code: number) => void;
    const execBarrier = new Promise<number>((resolve) => {
      releaseExec = resolve;
    });

    const mockFFmpeg = {
      on: vi.fn(),
      off: vi.fn(),
      writeFile: vi.fn(async () => true),
      exec: vi.fn(() => execBarrier),
      readFile: vi.fn(async () => new Uint8Array([0, 0, 0, 8])),
      listDir: vi.fn(async () => []),
      deleteFile: vi.fn(async () => true),
    } as unknown as FFmpeg;

    __setForgerDepsForTests({
      loadFFmpeg: async () => mockFFmpeg,
    });

    const inputBlob = new Blob([new Uint8Array([1, 2, 3])], {
      type: 'video/mp4',
    });
    const segments = [{ start: 0, end: 1, energy: 0.9 }];

    const firstJob = forgeVideo(inputBlob, segments, () => {});

    // Wait a microtask so firstJob enters exec
    await Promise.resolve();
    expect(isForgeInProgress()).toBe(true);

    // Second concurrent invocation must reject without unlocking firstJob
    await expect(forgeVideo(inputBlob, segments, () => {})).rejects.toThrow(
      /already running/i,
    );
    expect(isForgeInProgress()).toBe(true);

    releaseExec(0);
    const result = await firstJob;
    expect(result.type).toBe('video/mp4');
    expect(isForgeInProgress()).toBe(false);
  });
});

describe('Client-side input guardrails', () => {
  it('blocks files larger than 250 MB with a browser memory message', () => {
    expect(
      validateMediaFileSize({ name: 'ok.mp4', size: MAX_FILE_SIZE_BYTES }),
    ).toBeNull();

    const overErr = validateMediaFileSize({
      name: 'huge.mp4',
      size: MAX_FILE_SIZE_BYTES + 1,
    });
    expect(overErr).toMatch(/250 MB/);
    expect(overErr).toMatch(/memory/i);
  });

  it('blocks videos longer than 600 seconds (10 minutes) with a browser memory message', () => {
    expect(
      validateMediaDuration(MAX_VIDEO_DURATION_SEC, 'ten-min.mp4'),
    ).toBeNull();

    const overErr = validateMediaDuration(600.1, 'long-demo.mp4');
    expect(overErr).toMatch(/600/);
    expect(overErr).toMatch(/10-minute|10 minutes/i);
    expect(overErr).toMatch(/memory/i);

    expect(validateMediaDuration(Number.NaN, 'broken.mp4')).toMatch(/valid/i);
    expect(
      validateMediaDuration(Number.POSITIVE_INFINITY, 'stream.webm'),
    ).toMatch(/valid/i);
  });
});
