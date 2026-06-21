"use client";
import { useSyncStatus } from "@/lib/storage";

const LABEL: Record<string, { text: string; dot: string }> = {
  idle:    { text: "Local only",   dot: "bg-rose-200" },
  loading: { text: "Loading…",     dot: "bg-rose-300 animate-pulse" },
  saving:  { text: "Saving…",      dot: "bg-amber-400 animate-pulse" },
  synced:  { text: "Synced ✓",     dot: "bg-emerald-500" },
  offline: { text: "Offline",      dot: "bg-rose-400" },
  error:   { text: "Sync error",   dot: "bg-red-500" },
};

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const status = useSyncStatus();
  const label = LABEL[status];

  return (
    <header className="px-5 pt-6 pb-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-300 to-rose-500 shadow-soft grid place-items-center text-white text-xl">
          🧁
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl text-rose-700 leading-none">{title}</h1>
          {subtitle && <p className="text-xs text-rose-400 mt-1 truncate">{subtitle}</p>}
        </div>
        <span
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-rose-500 bg-white/80 backdrop-blur border border-rose-100 rounded-full px-2 py-1 shadow-soft shrink-0"
          title={`Sync status: ${status}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${label.dot}`} />
          {label.text}
        </span>
      </div>
    </header>
  );
}
