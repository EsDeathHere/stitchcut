import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { SilenceConfig } from '../types';

interface ControlPanelProps {
  config: SilenceConfig;
  disabled?: boolean;
  onChange: (next: SilenceConfig) => void;
  onReset: () => void;
}

function formatBudget(sec: number): string {
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  if (mins === 0) return `${rem}s`;
  return rem === 0 ? `${mins}m` : `${mins}m ${rem}s`;
}

export function ControlPanel({
  config,
  disabled = false,
  onChange,
  onReset,
}: ControlPanelProps) {
  const update = <K extends keyof SilenceConfig>(
    key: K,
    value: SilenceConfig[K],
  ) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-5 shadow-xl shadow-black/30 backdrop-blur-sm">
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
              Silence &amp; Budget Controls
            </h2>
            <p className="text-xs text-zinc-400">
              Tune DSP cut sensitivity and target demo length.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/80 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      <div className="space-y-5">
        {/* Silence Threshold (dB) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="silence-threshold"
              className="font-medium text-zinc-200"
            >
              Silence Threshold
            </label>
            <span className="rounded-md bg-zinc-950 px-2 py-0.5 font-mono font-semibold text-emerald-400 ring-1 ring-zinc-800 tabular-nums">
              {config.silenceThresholdDb} dB
            </span>
          </div>
          <input
            id="silence-threshold"
            type="range"
            min={-60}
            max={-10}
            step={1}
            disabled={disabled}
            value={config.silenceThresholdDb}
            onChange={(e) =>
              update('silenceThresholdDb', Number(e.target.value))
            }
            className="studio-slider w-full"
          />
          <div className="flex justify-between font-mono text-[10px] text-zinc-500">
            <span>-60 dB (sensitive)</span>
            <span>-35 dB</span>
            <span>-10 dB (aggressive)</span>
          </div>
        </div>

        {/* Min Silence Duration (s) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="min-silence" className="font-medium text-zinc-200">
              Min Silence Duration
            </label>
            <span className="rounded-md bg-zinc-950 px-2 py-0.5 font-mono font-semibold text-emerald-400 ring-1 ring-zinc-800 tabular-nums">
              {config.minSilenceDurationSec.toFixed(1)} s
            </span>
          </div>
          <input
            id="min-silence"
            type="range"
            min={0.1}
            max={3.0}
            step={0.1}
            disabled={disabled}
            value={config.minSilenceDurationSec}
            onChange={(e) =>
              update('minSilenceDurationSec', Number(e.target.value))
            }
            className="studio-slider w-full"
          />
          <div className="flex justify-between font-mono text-[10px] text-zinc-500">
            <span>0.1 s (tight)</span>
            <span>0.6 s</span>
            <span>3.0 s (relaxed)</span>
          </div>
        </div>

        {/* Target Budget (s) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="target-budget"
              className="font-medium text-zinc-200"
            >
              Target Budget
            </label>
            <span className="rounded-md bg-zinc-950 px-2 py-0.5 font-mono font-semibold text-violet-300 ring-1 ring-zinc-800 tabular-nums">
              {config.targetBudgetSec} s ({formatBudget(config.targetBudgetSec)})
            </span>
          </div>
          <input
            id="target-budget"
            type="range"
            min={10}
            max={600}
            step={5}
            disabled={disabled}
            value={config.targetBudgetSec}
            onChange={(e) => update('targetBudgetSec', Number(e.target.value))}
            className="studio-slider studio-slider-violet w-full"
          />
          <div className="flex justify-between font-mono text-[10px] text-zinc-500">
            <span>10 s</span>
            <span>180 s (3m)</span>
            <span>600 s (10m)</span>
          </div>
        </div>

        {/* Subtle padding readout */}
        <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3.5 py-2.5 text-[11px] text-zinc-400">
          <span>Breath Padding (Pre / Post Roll)</span>
          <span className="font-mono text-zinc-300 tabular-nums">
            {config.preRollMs} ms / {config.postRollMs} ms
          </span>
        </div>
      </div>
    </section>
  );
}
