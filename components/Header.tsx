"use client";
import { useState } from "react";
import { useSyncStatus, getSyncDiagnostics, type SyncDiagnostics } from "@/lib/storage";
import { useTheme } from "@/lib/theme";

const LABEL: Record<string, { text: string; dot: string }> = {
  idle:    { text: "Local",     dot: "bg-subtle" },
  loading: { text: "Sync",      dot: "bg-muted animate-pulse" },
  saving:  { text: "Saving",    dot: "bg-warn animate-pulse" },
  synced:  { text: "Synced",    dot: "bg-good" },
  offline: { text: "Offline",   dot: "bg-warn" },
  error:   { text: "Error",     dot: "bg-warn" },
};

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const status = useSyncStatus();
  const { theme, toggle } = useTheme();
  const [diag, setDiag] = useState<SyncDiagnostics | null>(null);
  const [openDiag, setOpenDiag] = useState(false);
  const label = LABEL[status];

  async function showDiag() {
    setOpenDiag(true);
    setDiag(null);
    setDiag(await getSyncDiagnostics());
  }

  function copy() {
    if (!diag) return;
    navigator.clipboard?.writeText(JSON.stringify(diag, null, 2));
    alert("Diagnostics copied.");
  }

  // Show the icon of the theme you'd switch to (universal toggle pattern).
  const themeIcon = theme === "dark" ? "☀" : "☾";
  const themeLabel = theme === "dark" ? "Switch to light" : "Switch to dark";

  return (
    <header className="px-5 pt-7 pb-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 rise rise-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-subtle mb-1">Baker's notebook</p>
          <h1 className="font-display text-[34px] leading-[0.95] text-ink">
            <span className="italic font-normal">Curly</span>
            <span className="font-semibold">Cakes</span>
          </h1>
          {subtitle && <p className="text-xs text-muted mt-2 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 rise rise-2">
          <button
            onClick={toggle}
            className="h-9 w-9 rounded-full border border-line bg-surface text-ink/80 text-base active:scale-95 transition"
            title={themeLabel}
            aria-label={themeLabel}
          >
            {themeIcon}
          </button>
          <button
            onClick={showDiag}
            className="h-9 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted bg-surface border border-line rounded-full px-3 active:scale-95 transition"
            title="Sync diagnostics"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${label.dot}`} />
            {label.text}
          </button>
        </div>
      </div>

      {openDiag && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm grid place-items-center p-4" onClick={() => setOpenDiag(false)}>
          <div className="card max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="font-display text-xl text-ink">Sync diagnostics</h2>
              <button onClick={() => setOpenDiag(false)} className="text-muted text-lg leading-none">×</button>
            </div>
            {!diag ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : (
              <>
                <ul className="text-xs space-y-1 text-ink">
                  <Row label="Status" value={diag.status} />
                  <Row label="Last error" value={diag.lastError ?? "—"} warn={!!diag.lastError} />
                  <Row label="In Telegram" value={diag.hasTelegram ? "yes" : "no"} />
                  <Row label="Platform" value={diag.platform ?? "—"} />
                  <Row label="Bot API" value={diag.version ?? "—"} />
                  <Row label="CloudStorage object" value={diag.hasCloudStorage ? "yes" : "no"} />
                  <Row label="CloudStorage usable" value={diag.cloudStorageReady ? "yes" : "no"} warn={!diag.cloudStorageReady && diag.hasTelegram} />
                  <Row label="User id" value={diag.userId?.toString() ?? "—"} />
                  <Row label="initData length" value={diag.initDataLen.toString()} warn={diag.initDataLen === 0 && diag.hasTelegram} />
                  <Row label="Cloud keys stored" value={diag.cloudKeysCount?.toString() ?? "—"} />
                </ul>
                <p className="text-[11px] text-muted">CloudStorage needs Telegram Bot API ≥ 6.9. Different user ids on phone vs desktop = different Telegram accounts.</p>
                <button onClick={copy} className="btn-ghost w-full text-sm">Copy diagnostics</button>
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
    <li className="flex justify-between gap-3 border-b border-line py-1.5">
      <span className="text-muted">{label}</span>
      <span className={`font-mono text-right break-all ${warn ? "text-warn font-bold" : ""}`}>{value}</span>
    </li>
  );
}
