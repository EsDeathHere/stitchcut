import { CheckCircle2, Clock, Scissors, Timer } from 'lucide-react';
import type { CutPlan } from '../types';

interface TimelineBarProps {
  plan: CutPlan | null;
  targetBudgetSec: number;
  hasFile: boolean;
}

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

export function TimelineBar({
  plan,
  targetBudgetSec,
  hasFile,
}: TimelineBarProps) {
  const original = plan?.originalDuration ?? 0;
  const forged = plan?.forgedDuration ?? 0;
  const stripped = plan?.strippedDuration ?? 0;
  const segments = plan?.segments ?? [];
  const savedPercent =
    original > 0 ? Math.min(100, Math.max(0, (stripped / original) * 100)) : 0;

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) =>
    original > 0 ? (original * i) / (tickCount - 1) : 0,
  );

  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-5 shadow-xl shadow-black/30 backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
            Cut Plan Timeline
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Visual comparison of kept speech segments vs. stripped dead air.
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
            Original Duration
          </div>
          <p className="mt-1.5 font-mono text-xl font-semibold text-zinc-100 tabular-nums">
            {hasFile ? formatDuration(original) : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/90 uppercase">
            <Timer className="h-3.5 w-3.5 text-emerald-400" />
            Forged Duration
          </div>
          <p className="mt-1.5 font-mono text-xl font-semibold text-emerald-400 tabular-nums">
            {hasFile ? formatDuration(forged) : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 uppercase">
            <Scissors className="h-3.5 w-3.5 text-violet-400" />
            Dead Air Stripped
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

      {/* Visual timeline track */}
      <div className="space-y-2">
        <div className="relative h-14 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 dead-air-pattern">
          {!hasFile ? (
            <div className="flex h-full items-center justify-center text-xs text-zinc-500">
              Load or drop a video to preview the cut timeline
            </div>
          ) : segments.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-zinc-400">
              No active speech segments detected for the current thresholds
            </div>
          ) : (
            segments.map((seg, idx) => {
              const leftPct = original > 0 ? (seg.start / original) * 100 : 0;
              const widthPct =
                original > 0
                  ? Math.max(0.6, ((seg.end - seg.start) / original) * 100)
                  : 0;
              return (
                <div
                  key={`${seg.start}-${seg.end}-${idx}`}
                  title={`Segment #${idx + 1}: ${seg.start.toFixed(2)}s – ${seg.end.toFixed(2)}s (${(seg.end - seg.start).toFixed(2)}s)`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                  className="absolute inset-y-1.5 rounded-md bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-sm shadow-emerald-950/60 ring-1 ring-emerald-300/40 transition-all hover:brightness-110"
                />
              );
            })
          )}
        </div>

        {/* Timecode ruler */}
        <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500 tabular-nums">
          {ticks.map((t, i) => (
            <span key={i}>{hasFile ? formatTimecode(t) : '0:00'}</span>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 ring-1 ring-emerald-300/50" />
            Kept Segments (Active Speech)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm border border-zinc-700 bg-zinc-900 dead-air-pattern" />
            Stripped Dead Air
          </span>
        </div>
      </div>
    </section>
  );
}
