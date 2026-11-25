import { Activity, CheckCircle2, Clock, Scissors, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AudioSegment, CutPlan } from '../types';

interface TimelineBarProps {
  plan: CutPlan | null;
  audioBuffer: AudioBuffer | null;
  targetBudgetSec: number;
  hasFile: boolean;
}

const WAVEFORM_BIN_COUNT = 96;

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0.0s';
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins}m ${rem.toFixed(1)}s`;
}

function formatTimecode(sec: number): string {
  const clamped = Math.max(0, sec);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatEnergyDb(rms: number): string {
  if (!Number.isFinite(rms) || rms <= 0) return '-∞ dBFS';
  return `${(20 * Math.log10(rms + 1e-10)).toFixed(1)} dBFS`;
}

function computeWaveformBins(
  audioBuffer: AudioBuffer | null,
  binCount: number,
): number[] {
  if (
    !audioBuffer ||
    audioBuffer.length === 0 ||
    audioBuffer.numberOfChannels === 0
  ) {
    return [];
  }

  const { length, numberOfChannels } = audioBuffer;
  const channels = Array.from({ length: numberOfChannels }, (_, ch) =>
    audioBuffer.getChannelData(ch),
  );
  const bins = Array.from({ length: binCount }, () => 0);
  let maxRms = 0;

  for (let b = 0; b < binCount; b++) {
    const startSample = Math.floor((b * length) / binCount);
    const endSample = Math.max(
      startSample + 1,
      Math.floor(((b + 1) * length) / binCount),
    );
    // Stride large buffers so UI waveform extraction stays < 2 ms even on 10-min audio
    const span = endSample - startSample;
    const stride = Math.max(1, Math.floor(span / 256));
    let sumSq = 0;
    let count = 0;

    for (let i = startSample; i < endSample; i += stride) {
      let mono = 0;
      for (let ch = 0; ch < numberOfChannels; ch++) {
        mono += channels[ch][i];
      }
      mono /= numberOfChannels;
      sumSq += mono * mono;
      count++;
    }

    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    bins[b] = rms;
    if (rms > maxRms) maxRms = rms;
  }

  if (maxRms <= 0) {
    return bins.map(() => 0.06);
  }

  return bins.map((rms) => Math.max(0.08, Math.min(1, rms / maxRms)));
}

export function TimelineBar({
  plan,
  audioBuffer,
  targetBudgetSec,
  hasFile,
}: TimelineBarProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const original = plan?.originalDuration ?? 0;
  const forged = plan?.forgedDuration ?? 0;
  const stripped = plan?.strippedDuration ?? 0;
  const segments = plan?.segments ?? [];
  const savedPercent =
    original > 0 ? Math.min(100, Math.max(0, (stripped / original) * 100)) : 0;

  const waveformBins = useMemo(
    () => computeWaveformBins(audioBuffer, WAVEFORM_BIN_COUNT),
    [audioBuffer],
  );

  const inspectedIndex =
    activeIdx !== null && activeIdx < segments.length ? activeIdx : null;
  const inspectedSegment: AudioSegment | null =
    inspectedIndex !== null ? segments[inspectedIndex] : null;

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) =>
    original > 0 ? (original * i) / (tickCount - 1) : 0,
  );

  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-5 shadow-xl shadow-black/30 backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
              Waveform &amp; Cut Plan Timeline
            </h2>
            <span className="rounded bg-zinc-800/90 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              20 ms Mono RMS
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            Interactive energy envelope distinguishing retained speech segments
            from excised dead air.
          </p>
        </div>

        {plan && hasFile && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                plan.withinBudget
                  ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 ring-amber-500/30'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {plan.withinBudget
                ? `Within ${targetBudgetSec}s Budget`
                : `Exceeds ${targetBudgetSec}s Budget`}
            </span>
            <span className="rounded-full bg-zinc-950 px-2.5 py-1 font-mono text-xs text-zinc-300 ring-1 ring-zinc-800 tabular-nums">
              {segments.length} {segments.length === 1 ? 'segment' : 'segments'}
            </span>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 uppercase">
            <Clock className="h-3.5 w-3.5 text-zinc-500" />
            Raw Specimen
          </div>
          <p className="mt-1.5 font-mono text-xl font-semibold text-zinc-100 tabular-nums">
            {hasFile ? formatDuration(original) : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/90 uppercase">
            <Timer className="h-3.5 w-3.5 text-emerald-400" />
            Stitched Output
          </div>
          <p className="mt-1.5 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
            {hasFile ? formatDuration(forged) : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 uppercase">
            <Scissors className="h-3.5 w-3.5 text-violet-400" />
            Dead Air Excised
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <p className="font-mono text-xl font-semibold text-zinc-200 tabular-nums">
              {hasFile ? formatDuration(stripped) : '—'}
            </p>
            {hasFile && original > 0 && (
              <span className="font-mono text-xs font-medium text-violet-400 tabular-nums">
                (-{savedPercent.toFixed(0)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive waveform + segment overlay track */}
      <div className="space-y-2">
        <div
          onMouseLeave={() => setActiveIdx(null)}
          className="relative h-20 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 dead-air-pattern"
        >
          {!hasFile ? (
            <div className="flex h-full items-center justify-center text-xs text-zinc-500">
              Load a raw specimen or click &ldquo;Try Sample Specimen&rdquo; to
              render the interactive RMS waveform
            </div>
          ) : (
            <>
              {/* Retained segment backdrop highlights + interactive buttons */}
              {segments.map((seg, idx) => {
                const leftPct = original > 0 ? (seg.start / original) * 100 : 0;
                const widthPct =
                  original > 0
                    ? Math.max(0.75, ((seg.end - seg.start) / original) * 100)
                    : 0;
                const isFocused = inspectedIndex === idx;
                return (
                  <button
                    key={`${seg.start}-${seg.end}-${idx}`}
                    type="button"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onFocus={() => setActiveIdx(idx)}
                    onClick={() =>
                      setActiveIdx((prev) => (prev === idx ? null : idx))
                    }
                    aria-label={`Inspect Segment ${idx + 1} from ${seg.start.toFixed(2)}s to ${seg.end.toFixed(2)}s`}
                    title={`Segment #${idx + 1}: ${seg.start.toFixed(2)}s – ${seg.end.toFixed(2)}s (${(seg.end - seg.start).toFixed(2)}s • ${formatEnergyDb(seg.energy)})`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                    }}
                    className={`absolute inset-y-1 z-10 cursor-pointer rounded-md border transition-all ${
                      isFocused
                        ? 'border-emerald-300 bg-emerald-500/30 shadow-md shadow-emerald-950/80'
                        : 'border-emerald-400/45 bg-emerald-500/18 hover:border-emerald-300/80 hover:bg-emerald-500/25'
                    }`}
                  />
                );
              })}

              {/* Real PCM mono RMS waveform bars */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-between gap-[2px] px-1.5 py-2"
              >
                {waveformBins.map((normAmp, binIdx) => {
                  const midSec =
                    original > 0
                      ? ((binIdx + 0.5) / waveformBins.length) * original
                      : 0;
                  const segIdx = segments.findIndex(
                    (s) => midSec >= s.start && midSec <= s.end,
                  );
                  const isRetained = segIdx !== -1;
                  const isSelectedBin =
                    segIdx !== -1 && inspectedIndex === segIdx;
                  const heightPct = Math.round(
                    (isRetained ? Math.max(0.18, normAmp) : normAmp * 0.55) *
                      100,
                  );

                  return (
                    <span
                      key={binIdx}
                      style={{ height: `${Math.max(8, heightPct)}%` }}
                      className={`flex-1 rounded-full transition-colors ${
                        isSelectedBin
                          ? 'bg-emerald-300'
                          : isRetained
                            ? 'bg-emerald-400/95'
                            : 'bg-zinc-700/70'
                      }`}
                    />
                  );
                })}
              </div>

              {segments.length === 0 && (
                <div className="relative z-20 flex h-full items-center justify-center bg-zinc-950/75 px-4 text-center text-xs text-zinc-300">
                  No active segments exceed the current threshold — lower the
                  Silence Threshold dB slider
                </div>
              )}
            </>
          )}
        </div>

        {/* Timecode ruler */}
        <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500 tabular-nums">
          {ticks.map((t, i) => (
            <span key={i}>{hasFile ? formatTimecode(t) : '0:00'}</span>
          ))}
        </div>

        {/* Interactive segment inspector + quick selector pills */}
        {hasFile && segments.length > 0 && (
          <div className="mt-2 rounded-xl border border-zinc-800/80 bg-zinc-950/75 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {inspectedSegment !== null && inspectedIndex !== null ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
                    <Activity className="h-3.5 w-3.5 text-emerald-400" />
                    Segment #{inspectedIndex + 1}
                  </span>
                  <span className="text-zinc-300 tabular-nums">
                    {inspectedSegment.start.toFixed(2)}s &rarr;{' '}
                    {inspectedSegment.end.toFixed(2)}s (
                    {(inspectedSegment.end - inspectedSegment.start).toFixed(2)}
                    s)
                  </span>
                  <span className="text-violet-300 tabular-nums">
                    RMS {formatEnergyDb(inspectedSegment.energy)}
                  </span>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                  <Activity className="h-3.5 w-3.5 text-emerald-400" />
                  Hover or click any emerald segment on the waveform to inspect
                  exact splice bounds &amp; RMS energy
                </span>
              )}

              <div className="flex flex-wrap items-center gap-1">
                {segments.slice(0, 8).map((seg, idx) => (
                  <button
                    key={`pill-${seg.start}-${idx}`}
                    type="button"
                    onClick={() =>
                      setActiveIdx((prev) => (prev === idx ? null : idx))
                    }
                    className={`cursor-pointer rounded-md px-2 py-0.5 font-mono text-[10px] transition tabular-nums ${
                      inspectedIndex === idx
                        ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/50'
                        : 'bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    #{idx + 1} {(seg.end - seg.start).toFixed(1)}s
                  </button>
                ))}
                {segments.length > 8 && (
                  <span className="px-1 font-mono text-[10px] text-zinc-500">
                    +{segments.length - 8} more
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400 ring-1 ring-emerald-300/50" />
            Retained High-Energy Segments
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm border border-zinc-700 bg-zinc-900 dead-air-pattern" />
            Trimmed Dead Air
          </span>
        </div>
      </div>
    </section>
  );
}
