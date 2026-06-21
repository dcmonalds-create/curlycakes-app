"use client";
import { useState } from "react";
import { useSyncStatus, getSyncDiagnostics, type SyncDiagnostics } from "@/lib/storage";

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
  const [diag, setDiag] = useState<SyncDiagnostics | null>(null);
  const [open, setOpen] = useState(false);
  const label = LABEL[status];

  async function show() {
    setOpen(true);
    setDiag(null);
    setDiag(await getSyncDiagnostics());
  }

  function copy() {
    if (!diag) return;
    navigator.clipboard?.writeText(JSON.stringify(diag, null, 2));
    alert("Diagnostics copied. Paste them to Claude.");
  }

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
        <button
          onClick={show}
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-rose-500 bg-white/80 backdrop-blur border border-rose-100 rounded-full px-2 py-1 shadow-soft shrink-0 active:scale-95 transition"
          title="Tap for sync diagnostics"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${label.dot}`} />
          {label.text}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-rose-900/30 backdrop-blur-sm grid place-items-center p-4" onClick={() => setOpen(false)}>
          <div className="card max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="font-display text-lg text-rose-700">🔍 Sync diagnostics</h2>
              <button onClick={() => setOpen(false)} className="text-rose-400">✕</button>
            </div>
            {!diag ? (
              <p className="text-sm text-rose-400">Loading…</p>
            ) : (
              <>
                <ul className="text-xs space-y-1 text-rose-700">
                  <Row label="Status" value={diag.status} />
                  <Row label="Last error" value={diag.lastError ?? "—"} warn={!!diag.lastError} />
                  <Row label="In Telegram?" value={diag.hasTelegram ? "yes" : "no"} />
                  <Row label="Platform" value={diag.platform ?? "—"} />
                  <Row label="Bot API version" value={diag.version ?? "—"} />
                  <Row label="CloudStorage object" value={diag.hasCloudStorage ? "yes" : "no"} />
                  <Row label="CloudStorage usable" value={diag.cloudStorageReady ? "yes" : "no"} warn={!diag.cloudStorageReady && diag.hasTelegram} />
                  <Row label="Telegram user id" value={diag.userId?.toString() ?? "—"} />
                  <Row label="initData length" value={diag.initDataLen.toString()} warn={diag.initDataLen === 0 && diag.hasTelegram} />
                  <Row label="Cloud keys stored" value={diag.cloudKeysCount?.toString() ?? "—"} />
                </ul>
                <p className="text-[11px] text-rose-400">
                  CloudStorage needs Bot API ≥ 6.9. If "usable" is no, your Telegram app may be too old — update it. If user ids differ between phone and desktop, you're logged into different accounts.
                </p>
                <button onClick={copy} className="btn-ghost w-full text-sm">📋 Copy diagnostics</button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <li className="flex justify-between gap-3 border-b border-rose-50 py-1">
      <span className="text-rose-400">{label}</span>
      <span className={`font-mono text-right break-all ${warn ? "text-red-500 font-bold" : ""}`}>{value}</span>
    </li>
  );
}
