import {
  CheckCircle2,
  Download,
  Film,
  Gauge,
  Loader2,
  ShieldCheck,
  Terminal,
  Wand2,
  XCircle,
} from 'lucide-react';
import type { ForgeProgress } from '../types';

export interface StageLogEntry {
  id: number;
  timestamp: string;
  stage: ForgeProgress['stage'];
  message: string;
}

export interface ForgeBenchmark {
  elapsedMs: number;
  dspAnalyzeMs: number | null;
  segmentCount: number;
  inputBytes: number;
  outputBytes: number;
  forgedDurationSec: number;
  strippedDurationSec: number;
}

interface ForgeWorkspaceProps {
  canForge: boolean;
  hasFile: boolean;
  segmentCount: number;
  progress: ForgeProgress;
  logs: StageLogEntry[];
  forgedUrl: string | null;
  forgedSizeBytes: number | null;
  benchmark: ForgeBenchmark | null;
  outputFileName: string;
  onForge: () => void;
}

const STAGE_LABELS: Record<ForgeProgress['stage'], string> = {
  idle: 'Ready',
  loading: 'Loading FFmpeg.wasm',
  analyzing: 'Analyzing Specimen',
  forging: 'Stitching MP4',
  done: 'Complete',
  error: 'Error',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatElapsed(ms: number): string {
  const roundedMs = Math.max(1, Math.round(ms));
  if (roundedMs < 1000) {
    return `${roundedMs} ms (${(roundedMs / 1000).toFixed(2)} s)`;
  }
  return `${(roundedMs / 1000).toFixed(2)} s (${roundedMs.toLocaleString()} ms)`;
}

export function ForgeWorkspace({
  canForge,
  hasFile,
  segmentCount,
  progress,
  logs,
  forgedUrl,
  forgedSizeBytes,
  benchmark,
  outputFileName,
  onForge,
}: ForgeWorkspaceProps) {
  const isWorking =
    progress.stage === 'loading' ||
    progress.stage === 'analyzing' ||
    progress.stage === 'forging';

  const percent = Math.min(100, Math.max(0, Math.round(progress.percent)));

  const realtimeFactor =
    benchmark && benchmark.elapsedMs > 0 && benchmark.forgedDurationSec > 0
      ? benchmark.forgedDurationSec / (benchmark.elapsedMs / 1000)
      : null;

  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-5 shadow-xl shadow-black/30 backdrop-blur-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
            <Film className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
              Stitcher&apos;s Forge &mdash; Stitched Output
            </h2>
            <p className="text-xs text-zinc-400">
              Splice retained high-energy segments into a single H.264/AAC MP4
              inside browser MEMFS.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onForge}
          disabled={!canForge || isWorking}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-950/50 transition hover:from-emerald-400 hover:to-emerald-500 disabled:cursor-not-allowed disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
        >
          {isWorking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          {isWorking ? 'Stitching Specimen...' : 'Forge Stitched MP4'}
        </button>
      </div>

      {!canForge && hasFile && !isWorking && (
        <p className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3.5 py-2.5 text-xs text-zinc-400">
          {segmentCount === 0
            ? 'No active segments are currently planned to stitch. Adjust the Silence Threshold or ensure speech energy is detected.'
            : 'Preparing audio analysis...'}
        </p>
      )}

      {/* Live progress bar */}
      <div className="mb-4 space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {progress.stage === 'done' && (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            )}
            {progress.stage === 'error' && (
              <XCircle className="h-4 w-4 text-rose-400" />
            )}
            {isWorking && (
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
            )}
            <span className="font-semibold text-zinc-200">
              {STAGE_LABELS[progress.stage]}
            </span>
            <span className="hidden text-zinc-500 sm:inline">•</span>
            <span className="truncate text-zinc-400">{progress.message}</span>
          </div>
          <span className="shrink-0 font-mono font-semibold text-emerald-400 tabular-nums">
            {percent}%
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            style={{ width: `${percent}%` }}
            className={`h-full rounded-full transition-all duration-300 ${
              progress.stage === 'error'
                ? 'bg-rose-500'
                : progress.stage === 'done'
                  ? 'bg-emerald-400'
                  : 'bg-gradient-to-r from-violet-500 to-emerald-400'
            }`}
          />
        </div>
      </div>

      {/* Stage Logs */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/90">
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-3.5 py-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-zinc-400 uppercase">
            <Terminal className="h-3.5 w-3.5 text-violet-400" />
            Stage Telemetry
          </span>
          <span className="font-mono text-[10px] text-zinc-500 tabular-nums">
            {logs.length} {logs.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        <div className="studio-scrollbar max-h-40 overflow-y-auto px-3.5 py-2.5 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-zinc-600">
              Awaiting raw specimen and stitch command...
            </p>
          ) : (
            <ul className="space-y-1.5">
              {logs.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-2.5 leading-relaxed"
                >
                  <span className="shrink-0 text-zinc-600 tabular-nums">
                    {entry.timestamp}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase ${
                      entry.stage === 'error'
                        ? 'bg-rose-500/15 text-rose-300'
                        : entry.stage === 'done'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : entry.stage === 'forging'
                            ? 'bg-violet-500/15 text-violet-300'
                            : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {entry.stage}
                  </span>
                  <span className="text-zinc-300">{entry.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Local Forge Benchmark + Stitched Output Video Preview */}
      {forgedUrl && (
        <div className="mt-5 space-y-4 rounded-xl border border-emerald-500/30 bg-zinc-950/90 p-4">
          {benchmark && (
            <div className="rounded-xl border border-violet-500/25 bg-gradient-to-r from-violet-950/30 via-zinc-950 to-emerald-950/25 p-3.5">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wide text-violet-200 uppercase">
                  <Gauge className="h-3.5 w-3.5 text-violet-400" />
                  Local Forge Benchmark
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" />0 Bytes Uploaded •
                  Zero-Server Privacy
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/80 px-3 py-2">
                  <p className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
                    WASM Stitch Time
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-emerald-300 tabular-nums">
                    {formatElapsed(benchmark.elapsedMs)}
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/80 px-3 py-2">
                  <p className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
                    DSP + Cut Plan
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-zinc-200 tabular-nums">
                    {benchmark.dspAnalyzeMs !== null
                      ? `${Math.round(benchmark.dspAnalyzeMs)} ms`
                      : '—'}
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/80 px-3 py-2">
                  <p className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
                    Throughput
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-violet-300 tabular-nums">
                    {realtimeFactor !== null
                      ? `${realtimeFactor.toFixed(2)}× real-time`
                      : `${benchmark.segmentCount} splices`}
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/80 px-3 py-2">
                  <p className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
                    MEMFS Hygiene
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-emerald-300">
                    Scratch Purged
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-300">
                Stitched Output Ready
              </p>
              <p className="font-mono text-xs text-zinc-400">
                {outputFileName}
                {forgedSizeBytes !== null &&
                  ` • ${formatFileSize(forgedSizeBytes)}`}
              </p>
            </div>

            <a
              href={forgedUrl}
              download={outputFileName}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 shadow-md shadow-emerald-950/50 transition hover:bg-emerald-400"
            >
              <Download className="h-4 w-4" />
              Download .mp4
            </a>
          </div>

          <video
            src={forgedUrl}
            controls
            playsInline
            className="aspect-video w-full rounded-lg border border-zinc-800 bg-black"
          />
        </div>
      )}
    </section>
  );
}
