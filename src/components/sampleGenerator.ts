export interface SampleLoadResult {
  file: File;
  source: 'public' | 'synthesized';
}

/**
 * Fetches `/sample-demo.mp4` if available and playable, or gracefully synthesizes
 * a clean in-browser test clip with alternating active audio bursts and silent dead air.
 */
export async function loadSampleVideo(
  onStatus?: (message: string) => void,
): Promise<SampleLoadResult> {
  onStatus?.('Checking for /sample-demo.mp4...');

  try {
    const response = await fetch('/sample-demo.mp4', { cache: 'no-store' });
    const contentType = (
      response.headers.get('content-type') ?? ''
    ).toLowerCase();

    if (response.ok && contentType.startsWith('video/')) {
      const blob = await response.blob();
      // Verify non-trivial payload and valid ISO BMFF / WebM signature rather than SPA HTML fallback
      if (blob.size > 1024 && (await hasValidVideoSignature(blob))) {
        const file = new File([blob], 'sample-demo.mp4', {
          type: blob.type || 'video/mp4',
        });
        return { file, source: 'public' };
      }
    }
  } catch {
    // Fall through to deterministic in-browser synthesis
  }

  onStatus?.('Synthesizing in-browser studio test clip (6s)...');
  const file = await synthesizeTestClip(6);
  return { file, source: 'synthesized' };
}

async function hasValidVideoSignature(blob: Blob): Promise<boolean> {
  try {
    const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (header.length < 12) return false;
    // ISO-BMFF / MP4: bytes 4..7 === 'ftyp'
    const isMp4 =
      header[4] === 0x66 &&
      header[5] === 0x74 &&
      header[6] === 0x79 &&
      header[7] === 0x70;
    // WebM / Matroska EBML header: 0x1A 0x45 0xDF 0xA3
    const isWebm =
      header[0] === 0x1a &&
      header[1] === 0x45 &&
      header[2] === 0xdf &&
      header[3] === 0xa3;
    return isMp4 || isWebm;
  } catch {
    return false;
  }
}

/**
 * Generates a clean, playable video+audio clip in the browser using Canvas + Web Audio + MediaRecorder.
 * Alternating active speech-like tone bursts and silent dead-air gaps make it ideal
 * for testing silence detection and FFmpeg stitching during live demos.
 */
async function synthesizeTestClip(durationSec: number): Promise<File> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder API is not supported in this browser.');
  }

  const width = 640;
  const height = 360;
  const fps = 24;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to acquire 2D canvas context.');
  }

  // Active bursts: [0.4–1.8s], [3.0–4.2s], [5.0–5.8s]; remainder is dead air
  const activeWindows: Array<[number, number, number]> = [
    [0.4, 1.8, 261.63],
    [3.0, 4.2, 329.63],
    [5.0, 5.8, 392.0],
  ];

  const renderFrame = (elapsedSec: number) => {
    const clampedElapsed = Math.max(0, Math.min(durationSec, elapsedSec));
    const isActive = activeWindows.some(
      ([s, e]) => clampedElapsed >= s && clampedElapsed <= e,
    );

    // Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Header badge
    ctx.fillStyle = isActive ? '#10b981' : '#52525b';
    ctx.fillRect(36, 36, 12, 12);
    ctx.fillStyle = '#f4f4f5';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('STITCHCUT // SYNTHESIZED SAMPLE', 60, 49);

    // Status pill
    ctx.fillStyle = isActive
      ? 'rgba(16, 185, 129, 0.16)'
      : 'rgba(113, 113, 122, 0.18)';
    ctx.fillRect(36, 86, 260, 44);
    ctx.fillStyle = isActive ? '#34d399' : '#a1a1aa';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(
      isActive ? '● ACTIVE SPEECH' : '○ DEAD AIR (SILENCE)',
      52,
      114,
    );

    // Animated waveform bars
    const barCount = 32;
    for (let i = 0; i < barCount; i++) {
      const barH = isActive
        ? 24 + Math.abs(Math.sin(clampedElapsed * 10 + i * 0.5)) * 78
        : 6;
      ctx.fillStyle = isActive ? '#10b981' : '#27272a';
      ctx.fillRect(36 + i * 18, 250 - barH / 2, 10, barH);
    }

    // Timecode
    ctx.fillStyle = '#e4e4e7';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`00:0${clampedElapsed.toFixed(2)}`, 450, 326);

    // Progress bar
    ctx.fillStyle = '#27272a';
    ctx.fillRect(36, 316, 380, 8);
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(
      36,
      316,
      Math.min(1, clampedElapsed / durationSec) * 380,
      8,
    );
  };

  // Draw initial frame before capturing stream so encoder gets a clean t=0 frame
  renderFrame(0);

  const audioCtx = new AudioContext();
  let combinedStream: MediaStream | null = null;
  let frameTimer: ReturnType<typeof setInterval> | null = null;

  try {
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    const destination = audioCtx.createMediaStreamDestination();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // Keep an inaudible -100 dB floor (1e-5) so MediaRecorder receives continuous
    // PCM packets across silent gaps without stream discontinuities.
    const SILENT_FLOOR = 0.00001;
    const ACTIVE_GAIN = 0.32;

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(SILENT_FLOOR, audioCtx.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(destination);

    const baseTime = audioCtx.currentTime + 0.05;
    for (const [start, end, freq] of activeWindows) {
      if (start >= durationSec) continue;
      const clampedEnd = Math.min(end, durationSec);
      oscillator.frequency.setValueAtTime(freq, baseTime + start);
      gainNode.gain.setValueAtTime(SILENT_FLOOR, baseTime + start);
      gainNode.gain.linearRampToValueAtTime(
        ACTIVE_GAIN,
        baseTime + start + 0.03,
      );
      gainNode.gain.setValueAtTime(ACTIVE_GAIN, baseTime + clampedEnd - 0.03);
      gainNode.gain.linearRampToValueAtTime(
        SILENT_FLOOR,
        baseTime + clampedEnd,
      );
    }

    oscillator.start(baseTime);
    oscillator.stop(baseTime + durationSec + 0.15);

    const canvasStream = canvas.captureStream(fps);
    combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);

    const mimeCandidates = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4',
    ];
    const selectedMime =
      mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

    const recorder = selectedMime
      ? new MediaRecorder(combinedStream, {
          mimeType: selectedMime,
          videoBitsPerSecond: 1_200_000,
          audioBitsPerSecond: 128_000,
        })
      : new MediaRecorder(combinedStream);

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    const recordingDone = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || selectedMime || 'video/webm';
        resolve(new Blob(chunks, { type: mimeType }));
      };
      recorder.onerror = () => {
        reject(new Error('Failed to record synthesized sample clip.'));
      };
    });

    recorder.start(100);

    const startWall = performance.now();
    // Use setInterval rather than requestAnimationFrame so background tabs never stall
    await new Promise<void>((resolve) => {
      const intervalMs = Math.max(16, Math.round(1000 / fps));
      frameTimer = setInterval(() => {
        const elapsed = (performance.now() - startWall) / 1000;
        renderFrame(elapsed);
        if (elapsed >= durationSec) {
          if (frameTimer !== null) {
            clearInterval(frameTimer);
            frameTimer = null;
          }
          resolve();
        }
      }, intervalMs);
    });

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    const blob = await recordingDone;

    if (blob.size === 0) {
      throw new Error('Synthesized sample clip produced an empty buffer.');
    }

    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    return new File([blob], `stitchcut-sample.${ext}`, {
      type: blob.type || (ext === 'mp4' ? 'video/mp4' : 'video/webm'),
    });
  } finally {
    if (frameTimer !== null) {
      clearInterval(frameTimer);
    }
    combinedStream?.getTracks().forEach((track) => track.stop());
    await audioCtx.close().catch(() => undefined);
  }
}
