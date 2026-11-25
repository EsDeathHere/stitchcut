import { Cpu, Scissors, ShieldCheck, ShieldOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { ForgeWorkspace } from './components/ForgeWorkspace';
import type { ForgeBenchmark, StageLogEntry } from './components/ForgeWorkspace';
import { IsolationBanner } from './components/IsolationBanner';
import { loadSampleVideo } from './components/sampleGenerator';
import { TimelineBar } from './components/TimelineBar';
import { UploadZone } from './components/UploadZone';
import { detectActiveSegments } from './dsp/silenceDetector';
import { forgeVideo, isForgeInProgress } from './ffmpeg/forger';
import {
  probeVideoDurationSec,
  validateMediaDuration,
  validateMediaFileSize,
} from './mediaGuardrails';
import { planCutSegments } from './planner/segmentPlanner';
import type { CutPlan, ForgeProgress, SilenceConfig } from './types';

const DEFAULT_SILENCE_CONFIG: SilenceConfig = {
  silenceThresholdDb: -35,
  minSilenceDurationSec: 0.6,
  preRollMs: 120,
  postRollMs: 150,
  targetBudgetSec: 180,
};

function nowStamp(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

function deriveOutputName(file: File | null): string {
  if (!file) return 'stitchcut-stitched.mp4';
  const base = file.name.replace(/\.[^.]+$/, '');
  return `${base}-stitchcut.mp4`;
}

export function App() {
  const isCrossOriginIsolated =
    typeof window !== 'undefined' && Boolean(window.crossOriginIsolated);

  const [file, setFile] = useState<File | null>(null);
  const [sampleSource, setSampleSource] = useState<
    'public' | 'synthesized' | null
  >(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [config, setConfig] = useState<SilenceConfig>(DEFAULT_SILENCE_CONFIG);

  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [sampleStatus, setSampleStatus] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isForgingActive, setIsForgingActive] = useState(false);
  const [guardrailError, setGuardrailError] = useState<string | null>(null);

  const [progress, setProgress] = useState<ForgeProgress>({
    stage: 'idle',
    percent: 0,
    message: 'Load a raw specimen to analyze RMS energy and stitch a tight cut.',
  });
  const [logs, setLogs] = useState<StageLogEntry[]>([]);

  const [forgedUrl, setForgedUrl] = useState<string | null>(null);
  const [forgedSizeBytes, setForgedSizeBytes] = useState<number | null>(null);
  const [dspAnalyzeMs, setDspAnalyzeMs] = useState<number | null>(null);
  const [forgeBenchmark, setForgeBenchmark] = useState<ForgeBenchmark | null>(
    null,
  );

  const logIdRef = useRef(1);
  const lastLoggedMsgRef = useRef<string>('');
  const forgedUrlRef = useRef<string | null>(null);
  const sourcePreviewUrlRef = useRef<string | null>(null);
  const isForgingRef = useRef(false);
  const mediaEpochRef = useRef(0);
  const mountedRef = useRef(true);

  const appendLog = useCallback(
    (stage: ForgeProgress['stage'], message: string) => {
      const key = `${stage}:${message}`;
      if (lastLoggedMsgRef.current === key) return;
      lastLoggedMsgRef.current = key;
      const entry: StageLogEntry = {
        id: logIdRef.current++,
        timestamp: nowStamp(),
        stage,
        message,
      };
      setLogs((prev) => [...prev.slice(-79), entry]);
    },
    [],
  );

  const replaceForgedUrl = useCallback(
    (nextUrl: string | null, sizeBytes: number | null = null) => {
      if (forgedUrlRef.current && forgedUrlRef.current !== nextUrl) {
        URL.revokeObjectURL(forgedUrlRef.current);
      }
      forgedUrlRef.current = nextUrl;
      setForgedUrl(nextUrl);
      setForgedSizeBytes(sizeBytes);
    },
    [],
  );

  const revokeSourcePreviewUrl = useCallback(() => {
    if (sourcePreviewUrlRef.current) {
      URL.revokeObjectURL(sourcePreviewUrlRef.current);
      sourcePreviewUrlRef.current = null;
    }
  }, []);

  const revokeAllPreviewUrls = useCallback(() => {
    replaceForgedUrl(null, null);
    revokeSourcePreviewUrl();
  }, [replaceForgedUrl, revokeSourcePreviewUrl]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (forgedUrlRef.current) {
        URL.revokeObjectURL(forgedUrlRef.current);
        forgedUrlRef.current = null;
      }
      if (sourcePreviewUrlRef.current) {
        URL.revokeObjectURL(sourcePreviewUrlRef.current);
        sourcePreviewUrlRef.current = null;
      }
    };
  }, []);

  const cutPlan: CutPlan | null = useMemo(() => {
    if (!audioBuffer) return null;
    const activeSegments = detectActiveSegments(audioBuffer, config);
    return planCutSegments(
      activeSegments,
      audioBuffer.duration,
      config.targetBudgetSec,
    );
  }, [audioBuffer, config]);

  const rejectWithGuardrail = useCallback(
    (errorMessage: string) => {
      revokeAllPreviewUrls();
      setFile(null);
      setSampleSource(null);
      setAudioBuffer(null);
      setDspAnalyzeMs(null);
      setForgeBenchmark(null);
      setGuardrailError(errorMessage);
      setProgress({ stage: 'error', percent: 0, message: errorMessage });
      appendLog('error', errorMessage);
    },
    [appendLog, revokeAllPreviewUrls],
  );

  const analyzeFile = useCallback(
    async (nextFile: File, source: 'public' | 'synthesized' | null) => {
      const epoch = ++mediaEpochRef.current;
      revokeAllPreviewUrls();
      setGuardrailError(null);
      setDspAnalyzeMs(null);
      setForgeBenchmark(null);

      // 1. Pre-read file size guardrail (> 250 MB blocked before arrayBuffer allocation)
      const sizeError = validateMediaFileSize(nextFile);
      if (sizeError) {
        rejectWithGuardrail(sizeError);
        return;
      }

      setIsAnalyzing(true);

      // 2. Fast container metadata duration check (> 600s blocked before PCM decode)
      const probedDuration = await probeVideoDurationSec(nextFile);
      if (!mountedRef.current || epoch !== mediaEpochRef.current) {
        setIsAnalyzing(false);
        return;
      }

      if (probedDuration !== null) {
        const metaDurationError = validateMediaDuration(
          probedDuration,
          nextFile.name,
        );
        if (metaDurationError) {
          setIsAnalyzing(false);
          rejectWithGuardrail(metaDurationError);
          return;
        }
      }

      setFile(nextFile);
      setSampleSource(source);
      setAudioBuffer(null);

      const startProgress: ForgeProgress = {
        stage: 'analyzing',
        percent: 15,
        message: `Decoding PCM audio from specimen "${nextFile.name}"...`,
      };
      setProgress(startProgress);
      appendLog('analyzing', startProgress.message);

      const audioCtx = new AudioContext();
      const t0 = performance.now();
      try {
        const arrayBuf = await nextFile.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuf);

        if (!mountedRef.current || epoch !== mediaEpochRef.current) {
          return;
        }

        // 3. Authoritative post-decode duration guardrail (catches WebM Infinity metadata & audio files > 600s)
        const decodedDurationError = validateMediaDuration(
          decoded.duration,
          nextFile.name,
        );
        if (decodedDurationError) {
          rejectWithGuardrail(decodedDurationError);
          return;
        }

        // Track fresh preview URL for the newly loaded video and revoke on next load/clear
        sourcePreviewUrlRef.current = URL.createObjectURL(nextFile);
        setAudioBuffer(decoded);

        const active = detectActiveSegments(decoded, config);
        const plan = planCutSegments(
          active,
          decoded.duration,
          config.targetBudgetSec,
        );
        const analyzeElapsedMs = Math.max(1, performance.now() - t0);
        setDspAnalyzeMs(analyzeElapsedMs);

        const readyMsg = `Decoded ${decoded.duration.toFixed(1)}s specimen (${(decoded.sampleRate / 1000).toFixed(1)} kHz) in ${analyzeElapsedMs.toFixed(0)} ms — ${plan.segments.length} retained segment${plan.segments.length === 1 ? '' : 's'} planned.`;
        setProgress({
          stage: 'idle',
          percent: 0,
          message: readyMsg,
        });
        appendLog('analyzing', readyMsg);
      } catch (err) {
        if (!mountedRef.current || epoch !== mediaEpochRef.current) {
          return;
        }
        const msg =
          err instanceof Error
            ? `Audio decode failed: ${err.message}`
            : 'Unable to decode audio track from this file.';
        setFile(null);
        setSampleSource(null);
        setAudioBuffer(null);
        setDspAnalyzeMs(null);
        setProgress({ stage: 'error', percent: 0, message: msg });
        appendLog('error', msg);
      } finally {
        if (mountedRef.current && epoch === mediaEpochRef.current) {
          setIsAnalyzing(false);
        }
        await audioCtx.close().catch(() => undefined);
      }
    },
    [appendLog, config, rejectWithGuardrail, revokeAllPreviewUrls],
  );

  const handleFileSelected = useCallback(
    (selected: File) => {
      if (isForgingRef.current || isForgeInProgress()) return;
      void analyzeFile(selected, null);
    },
    [analyzeFile],
  );

  const handleTrySample = useCallback(async () => {
    if (isForgingRef.current || isForgeInProgress()) return;
    setGuardrailError(null);
    setIsLoadingSample(true);
    setSampleStatus('Preparing lab specimen...');
    appendLog('loading', 'Requested built-in sample specimen...');

    try {
      const result = await loadSampleVideo((status) => {
        setSampleStatus(status);
        appendLog('loading', status);
      });
      setSampleStatus(null);
      await analyzeFile(result.file, result.source);
    } catch (err) {
      const msg =
        err instanceof Error
          ? `Sample video unavailable: ${err.message}`
          : 'Failed to prepare sample video.';
      setSampleStatus(null);
      setProgress({ stage: 'error', percent: 0, message: msg });
      appendLog('error', msg);
    } finally {
      setIsLoadingSample(false);
    }
  }, [analyzeFile, appendLog]);

  const handleClearFile = useCallback(() => {
    if (isForgingRef.current || isForgeInProgress()) return;
    mediaEpochRef.current++;
    revokeAllPreviewUrls();
    setFile(null);
    setSampleSource(null);
    setAudioBuffer(null);
    setSampleStatus(null);
    setGuardrailError(null);
    setDspAnalyzeMs(null);
    setForgeBenchmark(null);
    setProgress({
      stage: 'idle',
      percent: 0,
      message: 'Load a raw specimen to analyze RMS energy and stitch a tight cut.',
    });
    appendLog('idle', 'Cleared workspace specimen.');
  }, [appendLog, revokeAllPreviewUrls]);

  const handleForge = useCallback(async () => {
    if (
      !file ||
      !cutPlan ||
      cutPlan.segments.length === 0 ||
      isForgingRef.current ||
      isForgeInProgress()
    ) {
      return;
    }

    isForgingRef.current = true;
    setIsForgingActive(true);
    setForgeBenchmark(null);
    const forgeEpoch = mediaEpochRef.current;

    // Revoke previous forged preview URL before starting a re-forge
    replaceForgedUrl(null, null);
    lastLoggedMsgRef.current = '';

    const forgeStartMs = performance.now();
    try {
      const blob = await forgeVideo(file, cutPlan.segments, (p) => {
        if (!mountedRef.current || forgeEpoch !== mediaEpochRef.current) return;
        setProgress(p);
        appendLog(p.stage, p.message);
      });

      const elapsedMs = Math.max(1, performance.now() - forgeStartMs);
      const url = URL.createObjectURL(blob);
      if (!mountedRef.current || forgeEpoch !== mediaEpochRef.current) {
        URL.revokeObjectURL(url);
        return;
      }
      replaceForgedUrl(url, blob.size);
      setForgeBenchmark({
        elapsedMs,
        dspAnalyzeMs,
        segmentCount: cutPlan.segments.length,
        inputBytes: file.size,
        outputBytes: blob.size,
        forgedDurationSec: cutPlan.forgedDuration,
        strippedDurationSec: cutPlan.strippedDuration,
      });
      appendLog(
        'done',
        `Local Forge Benchmark: ${(elapsedMs / 1000).toFixed(2)}s (${Math.round(elapsedMs)} ms) • 0 bytes uploaded.`,
      );
    } catch {
      // Error state and log already reported by forgeVideo's onProgress
    } finally {
      isForgingRef.current = false;
      if (mountedRef.current) {
        setIsForgingActive(false);
      }
    }
  }, [appendLog, cutPlan, dspAnalyzeMs, file, replaceForgedUrl]);

  const isBusy =
    isForgingActive ||
    progress.stage === 'loading' ||
    progress.stage === 'forging' ||
    isAnalyzing;

  const canForge = Boolean(
    file && !isBusy && cutPlan && cutPlan.segments.length > 0,
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-100">
      {/* Subtle studio ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.10),_transparent_55%),radial-gradient(ellipse_at_top_right,_rgba(139,92,246,0.10),_transparent_50%)]"
      />

      {/* Top studio bar */}
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-violet-600 text-zinc-950 shadow-lg shadow-emerald-950/40">
              <Scissors className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  StitchCut
                </h1>
                <span className="rounded-md bg-violet-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-violet-300 uppercase ring-1 ring-violet-500/30">
                  Stitcher&apos;s Lab
                </span>
                <span className="hidden rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-emerald-300 uppercase ring-1 ring-emerald-500/25 md:inline">
                  Deterministic Energy Condenser
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Zero-server WebAudio RMS condenser &amp; self-hosted FFmpeg.wasm
                video stitcher
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1 font-mono text-[11px] text-zinc-300">
              <Cpu className="h-3.5 w-3.5 text-emerald-400" />
              FFmpeg.wasm (Self-Hosted)
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] ${
                isCrossOriginIsolated
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}
            >
              {isCrossOriginIsolated ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <ShieldOff className="h-3.5 w-3.5" />
              )}
              {isCrossOriginIsolated ? 'COI Active' : 'COI Inactive'}
            </span>
          </div>
        </div>
      </header>

      {/* Main studio canvas */}
      <main className="relative mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
        <IsolationBanner isIsolated={isCrossOriginIsolated} />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left column: Upload + Timeline + Forge Workspace */}
          <div className="space-y-5 lg:col-span-8">
            <UploadZone
              file={file}
              durationSec={audioBuffer?.duration ?? 0}
              sampleRate={audioBuffer?.sampleRate ?? null}
              sampleSource={sampleSource}
              isLoadingSample={isLoadingSample}
              sampleStatus={sampleStatus}
              isAnalyzing={isAnalyzing}
              disabled={isForgingActive}
              guardrailError={guardrailError}
              onDismissError={() => setGuardrailError(null)}
              onFileSelected={handleFileSelected}
              onTrySample={handleTrySample}
              onClearFile={handleClearFile}
            />

            <TimelineBar
              plan={cutPlan}
              audioBuffer={audioBuffer}
              targetBudgetSec={config.targetBudgetSec}
              hasFile={Boolean(file && audioBuffer)}
            />

            <ForgeWorkspace
              canForge={canForge}
              hasFile={Boolean(file)}
              segmentCount={cutPlan?.segments.length ?? 0}
              progress={progress}
              logs={logs}
              forgedUrl={forgedUrl}
              forgedSizeBytes={forgedSizeBytes}
              benchmark={forgeBenchmark}
              outputFileName={deriveOutputName(file)}
              onForge={handleForge}
            />
          </div>

          {/* Right column: SilenceConfig controls */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-20">
              <ControlPanel
                config={config}
                disabled={isBusy}
                onChange={setConfig}
                onReset={() => setConfig(DEFAULT_SILENCE_CONFIG)}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
