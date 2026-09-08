'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

/* ────────────────────────────────────────────────────────────────
   The three things every console panel says before it has a table to show.

   Each section used to spell all three out itself, which is how the console
   ended up with six slightly different "loading…" blocks and two different
   retry buttons. One definition, used everywhere.
   ──────────────────────────────────────────────────────────────── */

export function PanelLoading({ message, accent = 'text-cyber-blue' }: { message: string; accent?: string }) {
  return (
    <div className="p-12 text-center text-white/40 text-xs flex flex-col items-center gap-3">
      <RefreshCw className={`w-6 h-6 animate-spin ${accent}`} />
      {message}
    </div>
  );
}

export function PanelError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-12 text-center text-rose-300 text-xs flex flex-col items-center gap-2">
      <AlertTriangle className="w-6 h-6 text-rose-400" />
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-3 py-1.5 bg-rose-950/30 border border-rose-500/25 hover:bg-rose-950/50 text-rose-300 rounded-lg text-[10px] font-bold transition cursor-pointer"
        >
          TRY AGAIN
        </button>
      )}
    </div>
  );
}

export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-12 text-center text-white/30 text-xs leading-relaxed">{children}</div>
  );
}

/** The heading every section carries, matching the student workspace's. */
export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-outline-variant pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-xl font-mono font-bold tracking-wide flex items-center gap-2 text-on-surface">
          <Icon className="w-5 h-5 text-primary" />
          {title}
        </h2>
        <p className="text-xs text-outline font-mono mt-0.5">{subtitle}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}
