import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';

interface IsolationBannerProps {
  isIsolated: boolean;
}

export function IsolationBanner({ isIsolated }: IsolationBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (isIsolated || dismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      className="relative flex items-start gap-3.5 rounded-xl border border-amber-500/30 bg-amber-950/35 px-4 py-3.5 text-sm text-amber-100 shadow-lg shadow-amber-950/20 backdrop-blur-sm"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
        <ShieldAlert className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-semibold tracking-tight text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Cross-Origin Isolation Disabled
          </span>
          <code className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-xs text-amber-200">
            window.crossOriginIsolated === false
          </code>
        </div>
        <p className="text-xs leading-relaxed text-amber-200/80">
          <code className="font-mono text-amber-100">SharedArrayBuffer</code> is
          unavailable in this browsing context. Serve StitchCut with{' '}
          <code className="font-mono text-amber-100">
            Cross-Origin-Opener-Policy: same-origin
          </code>{' '}
          and{' '}
          <code className="font-mono text-amber-100">
            Cross-Origin-Embedder-Policy: require-corp
          </code>{' '}
          headers for optimal FFmpeg.wasm execution.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss isolation warning"
        className="rounded-lg p-1 text-amber-300/70 transition hover:bg-amber-500/15 hover:text-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
