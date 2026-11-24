import {
  AlertCircle,
  FileVideo,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';

interface UploadZoneProps {
  file: File | null;
  durationSec: number;
  sampleRate: number | null;
  sampleSource: 'public' | 'synthesized' | null;
  isLoadingSample: boolean;
  sampleStatus: string | null;
  isAnalyzing: boolean;
  disabled?: boolean;
  guardrailError: string | null;
  onDismissError: () => void;
  onFileSelected: (file: File) => void;
  onTrySample: () => void;
  onClearFile: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const mins = Math.floor(sec / 60);
  const rem = Math.floor(sec % 60);
  return `${mins}:${rem.toString().padStart(2, '0')}`;
}

export function UploadZone({
  file,
  durationSec,
  sampleRate,
  sampleSource,
  isLoadingSample,
  sampleStatus,
  isAnalyzing,
  disabled = false,
  guardrailError,
  onDismissError,
  onFileSelected,
  onTrySample,
  onClearFile,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      onFileSelected(dropped);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && !disabled) {
      onFileSelected(selected);
    }
    e.target.value = '';
  };

  return (
    <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-5 shadow-xl shadow-black/30 backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
            Source Media
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Drop a raw recording (up to 250 MB / 10 min) to strip dead air
            locally in your browser.
          </p>
        </div>

        <button
          type="button"
          onClick={onTrySample}
          disabled={isLoadingSample || isAnalyzing || disabled}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-600/20 px-4 py-2 text-xs font-semibold text-violet-200 shadow-sm shadow-violet-950/40 transition hover:border-violet-400/70 hover:bg-violet-600/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoadingSample ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-violet-300" />
          )}
          {isLoadingSample ? 'Preparing Sample...' : 'Try Sample Video'}
        </button>
      </div>

      {guardrailError && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-500/35 bg-rose-950/40 px-3.5 py-3 text-xs text-rose-100"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div className="space-y-0.5">
              <p className="font-semibold text-rose-200">
                Browser Memory Guardrail
              </p>
              <p className="leading-relaxed text-rose-200/90">
                {guardrailError}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss error"
            className="rounded-md p-1 text-rose-300/70 transition hover:bg-rose-500/15 hover:text-rose-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*"
        disabled={disabled}
        onChange={handleInputChange}
        className="hidden"
      />

      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!disabled) inputRef.current?.click();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
            isDragging
              ? 'border-emerald-400 bg-emerald-500/10'
              : 'border-zinc-700/80 bg-zinc-950/60 hover:border-zinc-500 hover:bg-zinc-950/90'
          }`}
        >
          <div
            className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition ${
              isDragging
                ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40'
                : 'bg-zinc-900 text-zinc-400 ring-zinc-700/80 group-hover:text-emerald-300 group-hover:ring-emerald-500/40'
            }`}
          >
            <Upload className="h-5 w-5" />
          </div>

          <p className="text-sm font-medium text-zinc-200">
            Drag &amp; drop a video file here, or{' '}
            <span className="text-emerald-400 underline decoration-emerald-500/40 underline-offset-4">
              browse files
            </span>
          </p>
          <p className="mt-1.5 text-xs text-zinc-500">
            Supports MP4, WebM, MOV (max 250 MB • max 10 min) — 100%
            client-side WebAudio &amp; FFmpeg.wasm
          </p>

          {sampleStatus && (
            <p className="mt-3 rounded-lg bg-violet-500/10 px-3 py-1.5 font-mono text-xs text-violet-300 ring-1 ring-violet-500/25">
              {sampleStatus}
            </p>
          )}
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 transition ${
            isDragging
              ? 'border-emerald-400 bg-emerald-500/10'
              : 'border-zinc-800 bg-zinc-950/75'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
              {isAnalyzing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileVideo className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-zinc-100">
                  {file.name}
                </p>
                {sampleSource === 'synthesized' && (
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-violet-300 uppercase ring-1 ring-violet-500/30">
                    Synthesized Clip
                  </span>
                )}
                {sampleSource === 'public' && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-300 uppercase ring-1 ring-emerald-500/30">
                    Sample Demo
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-zinc-400">
                <span>{formatBytes(file.size)}</span>
                <span className="text-zinc-600">•</span>
                <span>Duration {formatClock(durationSec)}</span>
                {sampleRate && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span>{(sampleRate / 1000).toFixed(1)} kHz</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-lg border border-zinc-700/80 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Replace
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onClearFile}
              aria-label="Remove video"
              className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
