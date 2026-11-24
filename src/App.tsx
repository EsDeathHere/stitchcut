import { Cpu, Scissors, ShieldCheck, ShieldOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { ForgeWorkspace } from './components/ForgeWorkspace';
import type { StageLogEntry } from './components/ForgeWorkspace';
import { IsolationBanner } from './components/IsolationBanner';
import { loadSampleVideo } from './components/sampleGenerator';
import { TimelineBar } from './components/TimelineBar';
import { UploadZone } from './components/UploadZone';
import { detectActiveSegments } from './dsp/silenceDetector';
import { forgeVideo } from './ffmpeg/forger';
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
  if (!file) return 'stitchcut-forged.mp4';
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

  const [progress, setProgress] = useState<ForgeProgress>({
    stage: 'idle',
    percent: 0,
    message: 'Load a video to analyze silence and forge a tight cut.',
  });
  const [logs, setLogs] = useState<StageLogEntry[]>([]);

  const [forgedUrl, setForgedUrl] = useState<string | null>(null);
  const [forgedSizeBytes, setForgedSizeBytes] = useState<number | null>(null);

  const logIdRef = useRef(1);
  const lastLoggedMsgRef = useRef<string>('');

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

  const revokeForgedOutput = useCallback(() => {
    setForgedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setForgedSizeBytes(null);
  }, []);

  useEffect(() => {
    return () => {
      if (forgedUrl) {
        URL.revokeObjectURL(forgedUrl);
      }
    };
  }, [forgedUrl]);

  const cutPlan: CutPlan | null = useMemo(() => {
    if (!audioBuffer) return null;
    const activeSegments = detectActiveSegments(audioBuffer, config);
    return planCutSegments(
      activeSegments,
      audioBuffer.duration,
      config.targetBudgetSec,
    );
  }, [audioBuffer, config]);

  const analyzeFile = useCallback(
    async (nextFile: File, source: 'public' | 'synthesized' | null) => {
      revokeForgedOutput();
      setFile(nextFile);
      setSampleSource(source);
      setAudioBuffer(null);
      setIsAnalyzing(true);

      const startProgress: ForgeProgress = {
        stage: 'analyzing',
        percent: 15,
        message: `Decoding audio track from "${nextFile.name}"...`,
      };
      setProgress(startProgress);
      appendLog('analyzing', startProgress.message);

      const audioCtx = new AudioContext();
      try {
        const arrayBuf = await nextFile.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        setAudioBuffer(decoded);

        const active = detectActiveSegments(decoded, config);
        const plan = planCutSegments(
          active,
          decoded.duration,
          config.targetBudgetSec,
        );

        const readyMsg = `Decoded ${decoded.duration.toFixed(1)}s audio (${(decoded.sampleRate / 1000).toFixed(1)} kHz) — ${plan.segments.length} active segment${plan.segments.length === 1 ? '' : 's'} planned.`;
        setProgress({
          stage: 'idle',
          percent: 0,
          message: readyMsg,
        });
        appendLog('analyzing', readyMsg);
      } catch (err) {
        const msg =
          err instanceof Error
            ? `Audio decode failed: ${err.message}`
            : 'Unable to decode audio track from this file.';
        setProgress({ stage: 'error', percent: 0, message: msg });
        appendLog('error', msg);
      } finally {
        setIsAnalyzing(false);
        await audioCtx.close().catch(() => undefined);
      }
    },
    [appendLog, config, revokeForgedOutput],
  );

  const handleFileSelected = useCallback(
    (selected: File) => {
      void analyzeFile(selected, null);
    },
    [analyzeFile],
  );

  const handleTrySample = useCallback(async () => {
    setIsLoadingSample(true);
    setSampleStatus('Fetching sample video...');
    appendLog('loading', 'Requested sample demo video...');

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
    revokeForgedOutput();
    setFile(null);
    setSampleSource(null);
    setAudioBuffer(null);
    setSampleStatus(null);
    setProgress({
      stage: 'idle',
      percent: 0,
      message: 'Load a video to analyze silence and forge a tight cut.',
    });
    appendLog('idle', 'Cleared workspace media.');
  }, [appendLog, revokeForgedOutput]);

  const handleForge = useCallback(async () => {
    if (!file || !cutPlan || cutPlan.segments.length === 0) return;

    revokeForgedOutput();
    lastLoggedMsgRef.current = '';

    try {
      const blob = await forgeVideo(file, cutPlan.segments, (p) => {
        setProgress(p);
        appendLog(p.stage, p.message);
      });

      const url = URL.createObjectURL(blob);
      setForgedUrl(url);
      setForgedSizeBytes(blob.size);
    } catch {
      // Error state and log already reported by forgeVideo's onProgress
    }
  }, [appendLog, cutPlan, file, revokeForgedOutput]);

  const canForge = Boolean(
    file && !isAnalyzing && cutPlan && cutPlan.segments.length > 0,
  );

  const isForging =
    progress.stage === 'loading' ||
    progress.stage === 'forging' ||
    isAnalyzing;

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
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  StitchCut
                </h1>
                <span className="rounded-md bg-violet-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-violet-300 uppercase ring-1 ring-violet-500/30">
                  Kiroween Studio
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Browser-native silence removal &amp; FFmpeg.wasm video forger
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1 font-mono text-[11px] text-zinc-300">
              <Cpu className="h-3.5 w-3.5 text-emerald-400" />
              FFmpeg.wasm
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
              onFileSelected={handleFileSelected}
              onTrySample={handleTrySample}
              onClearFile={handleClearFile}
            />

            <TimelineBar
              plan={cutPlan}
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
              outputFileName={deriveOutputName(file)}
              onForge={handleForge}
            />
          </div>

          {/* Right column: SilenceConfig controls */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-20">
              <ControlPanel
                config={config}
                disabled={isForging}
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
