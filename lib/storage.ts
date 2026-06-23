"use client";
import { useEffect, useRef, useState } from "react";

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ---- Telegram CloudStorage adapter ------------------------------------------
// Telegram CloudStorage: 1024 keys × 4096 bytes per value, synced per (user, bot)
// across all the user's Telegram clients. Available in Bot API 6.9+ (Apr 2023).

const CHUNK_SIZE = 3800;            // safety margin under 4096
const MAX_CHUNKS = 32;              // up to ~120KB per logical key

interface CloudStorage {
  setItem: (key: string, value: string, cb?: (err: Error | null, success: boolean) => void) => void;
  getItem: (key: string, cb: (err: Error | null, value: string) => void) => void;
  getItems: (keys: string[], cb: (err: Error | null, values: Record<string, string>) => void) => void;
  removeItem: (key: string, cb?: (err: Error | null, success: boolean) => void) => void;
  removeItems: (keys: string[], cb?: (err: Error | null, success: boolean) => void) => void;
  getKeys: (cb: (err: Error | null, keys: string[]) => void) => void;
}

function cloudStorage(): CloudStorage | null {
  if (typeof window === "undefined") return null;
  // @ts-ignore
  const wa = window.Telegram?.WebApp;
  if (!wa || !wa.CloudStorage) return null;
  // CloudStorage requires Bot API 6.9+. Outside Telegram (or in old clients),
  // the SDK polyfill reports a low version and silently errors on every call.
  if (typeof wa.isVersionAtLeast === "function" && !wa.isVersionAtLeast("6.9")) return null;
  // Browser fallback: SDK has no real Telegram initData → not a real client.
  if (!wa.initData) return null;
  return wa.CloudStorage as CloudStorage;
}

// Telegram CloudStorage key constraint: only [A-Za-z0-9_-], length 1–128.
// Our local keys use colons (cc:lists). Replace at the boundary.
function safeKey(k: string): string {
  return k.replace(/[^A-Za-z0-9_-]/g, "_");
}

// Chunked write to CloudStorage: split value into parts of CHUNK_SIZE.
// Index is stored at `<key>` with format `n:<count>` (value is unrestricted, only the key needs sanitizing).
// Parts at `<key>_0`, `<key>_1`, ...
async function cloudWrite(key: string, value: string): Promise<void> {
  const cs = cloudStorage();
  if (!cs) throw new Error("CloudStorage not available");
  const base = safeKey(key);
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    parts.push(value.slice(i, i + CHUNK_SIZE));
  }
  if (parts.length > MAX_CHUNKS) throw new Error(`Data too large (${value.length} bytes)`);

  const writes: Promise<void>[] = [];
  writes.push(setItemP(cs, base, `n:${parts.length}`));
  parts.forEach((part, i) => writes.push(setItemP(cs, `${base}_${i}`, part)));
  // Best-effort: remove leftover chunks from a previous larger value
  for (let i = parts.length; i < MAX_CHUNKS; i++) {
    writes.push(removeItemP(cs, `${base}_${i}`).catch(() => undefined));
  }
  await Promise.all(writes);
}

async function cloudRead(key: string): Promise<string | null> {
  const cs = cloudStorage();
  if (!cs) throw new Error("CloudStorage not available");
  const base = safeKey(key);
  const meta = await getItemP(cs, base);
  if (!meta) return null;
  const match = meta.match(/^n:(\d+)$/);
  if (!match) {
    // Legacy / un-chunked: treat as full value
    return meta;
  }
  const count = Number(match[1]);
  if (!count) return "";
  const keys = Array.from({ length: count }, (_, i) => `${base}_${i}`);
  const values = await getItemsP(cs, keys);
  return keys.map((k) => values[k] ?? "").join("");
}

const CLOUD_TIMEOUT_MS = 5000;

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((res, rej) => {
    const t = setTimeout(() => rej(new Error(`Telegram CloudStorage timed out: ${label}`)), CLOUD_TIMEOUT_MS);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
}

function setItemP(cs: CloudStorage, k: string, v: string) {
  return withTimeout(new Promise<void>((res, rej) => {
    try { cs.setItem(k, v, (e) => (e ? rej(e) : res())); } catch (err) { rej(err as Error); }
  }), `setItem ${k}`);
}
function getItemP(cs: CloudStorage, k: string) {
  return withTimeout(new Promise<string>((res, rej) => {
    try { cs.getItem(k, (e, v) => (e ? rej(e) : res(v))); } catch (err) { rej(err as Error); }
  }), `getItem ${k}`);
}
function getItemsP(cs: CloudStorage, keys: string[]) {
  return withTimeout(new Promise<Record<string, string>>((res, rej) => {
    try { cs.getItems(keys, (e, v) => (e ? rej(e) : res(v))); } catch (err) { rej(err as Error); }
  }), `getItems[${keys.length}]`);
}
function removeItemP(cs: CloudStorage, k: string) {
  return withTimeout(new Promise<void>((res, rej) => {
    try { cs.removeItem(k, (e) => (e ? rej(e) : res())); } catch (err) { rej(err as Error); }
  }), `removeItem ${k}`);
}

// ---- Hybrid sync hook -------------------------------------------------------
// • Inside Telegram: reads CloudStorage on mount, writes to CloudStorage (debounced)
//   AND localStorage (instant cache). Other devices see updates next time they open.
// • Outside Telegram: localStorage only.
// • Migration: if cloud is empty but localStorage has data, push it up on first save.

export type SyncStatus = "idle" | "loading" | "saving" | "synced" | "offline" | "error";

// Module-level sync indicator: any key reports its status here, header listens.
type Listener = (s: SyncStatus) => void;
const listeners = new Set<Listener>();
let globalStatus: SyncStatus = "idle";
let lastError: string | null = null;

function setGlobal(s: SyncStatus, err?: unknown) {
  globalStatus = s;
  if (err) {
    lastError = err instanceof Error ? err.message : String(err);
  } else if (s === "synced") {
    lastError = null;
  }
  listeners.forEach((l) => l(s));
}
export function useSyncStatus() {
  const [s, setS] = useState<SyncStatus>(globalStatus);
  useEffect(() => {
    listeners.add(setS);
    setS(globalStatus);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

export interface SyncDiagnostics {
  status: SyncStatus;
  lastError: string | null;
  hasTelegram: boolean;
  hasCloudStorage: boolean;
  cloudStorageReady: boolean;
  version: string | null;
  platform: string | null;
  hasInitData: boolean;
  initDataLen: number;
  userId: number | null;
  cloudKeysCount: number | null;
}

export async function getSyncDiagnostics(): Promise<SyncDiagnostics> {
  const wa: any = typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;
  const cs = cloudStorage();
  let cloudKeysCount: number | null = null;
  if (cs) {
    try {
      const keys = await withTimeout(new Promise<string[]>((res, rej) => {
        try { cs.getKeys((e, k) => (e ? rej(e) : res(k))); } catch (err) { rej(err as Error); }
      }), "getKeys");
      cloudKeysCount = keys.length;
    } catch {}
  }
  return {
    status: globalStatus,
    lastError,
    hasTelegram: !!wa,
    hasCloudStorage: !!wa?.CloudStorage,
    cloudStorageReady: !!cs,
    version: wa?.version ?? null,
    platform: wa?.platform ?? null,
    hasInitData: !!wa?.initData,
    initDataLen: wa?.initData?.length ?? 0,
    userId: wa?.initDataUnsafe?.user?.id ?? null,
    cloudKeysCount,
  };
}

export function useLocalState<T>(key: string, initial: T) {
  const [value, setValueRaw] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usingCloud = useRef<boolean>(false);
  // Tracks the last JSON string written to OR read from cloud.
  // The persist effect skips a write if value hasn't changed since the last sync,
  // preventing spurious SAVING→ERROR cycles triggered by the cloud read itself.
  const lastCloudSync = useRef<string | null>(null);
  // Set to true the moment the user calls setValue(). If the cloud read arrives
  // after the user has already made a change, we discard the cloud value so we
  // don't overwrite the user's in-progress edit.
  const userModified = useRef(false);

  // Load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) Read localStorage instantly so UI isn't blank on cold load
      let local: T | null = null;
      try {
        const raw = localStorage.getItem(key);
        if (raw) local = JSON.parse(raw) as T;
      } catch {}
      if (!cancelled && local !== null) setValueRaw(local);

      // 2) If inside Telegram, prefer cloud
      const cs = cloudStorage();
      if (cs) {
        usingCloud.current = true;
        setStatus("loading"); setGlobal("loading");
        try {
          const cloudRaw = await cloudRead(key);
          if (cancelled) return;
          if (cloudRaw) {
            try {
              const cloudVal = JSON.parse(cloudRaw) as T;
              const normalized = JSON.stringify(cloudVal);
              // Only apply cloud value if the user hasn't already made a local change.
              // If they edited before the cloud responded, their edit wins.
              if (!userModified.current) {
                setValueRaw(cloudVal);
                localStorage.setItem(key, normalized);
                lastCloudSync.current = normalized; // mark as synced only when we actually applied it
              }
              // If userModified: don't update lastCloudSync — let persist effect
              // detect the difference and write the user's value to cloud.
            } catch {}
          } else if (local !== null && !userModified.current) {
            // Cloud is empty but we have local data — migrate it up.
            const normalized = JSON.stringify(local);
            await cloudWrite(key, normalized);
            lastCloudSync.current = normalized;
          }
          setStatus("synced"); setGlobal("synced");
        } catch (e) {
          setStatus("offline"); setGlobal("offline", e);
        }
      }

      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist (debounced for cloud, immediate for local cache)
  useEffect(() => {
    if (!hydrated) return;
    const serialized = JSON.stringify(value);
    try { localStorage.setItem(key, serialized); } catch {}

    if (!usingCloud.current) return;

    // Skip cloud write if the value hasn't changed since the last cloud read or write.
    // This prevents the cloud-read on mount from immediately triggering a redundant save.
    if (lastCloudSync.current === serialized) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setStatus("saving"); setGlobal("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await cloudWrite(key, serialized);
        lastCloudSync.current = serialized;
        setStatus("synced"); setGlobal("synced");
      } catch (e) {
        setStatus("error"); setGlobal("error", e);
      }
    }, 400);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [key, value, hydrated]);

  const setValue = (next: T | ((prev: T) => T)) => {
    userModified.current = true;
    setValueRaw(next as T);
  };

  return [value, setValue, hydrated, status] as const;
}

// Convenience: read current sync status across known keys (for header indicator).
// Components can call useLocalState to get per-key status; the App can show the
// most-pending one. For simplicity we expose a global event-based listener too.
