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

// Chunked write to CloudStorage: split value into parts of CHUNK_SIZE.
// Index is stored at `<key>` with format `n:<count>`. Parts at `<key>:0`, `<key>:1`, ...
async function cloudWrite(key: string, value: string): Promise<void> {
  const cs = cloudStorage();
  if (!cs) throw new Error("CloudStorage not available");
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    parts.push(value.slice(i, i + CHUNK_SIZE));
  }
  if (parts.length > MAX_CHUNKS) throw new Error(`Data too large (${value.length} bytes)`);

  const writes: Promise<void>[] = [];
  writes.push(setItemP(cs, key, `n:${parts.length}`));
  parts.forEach((part, i) => writes.push(setItemP(cs, `${key}:${i}`, part)));
  // Best-effort: remove leftover chunks from a previous larger value
  for (let i = parts.length; i < MAX_CHUNKS; i++) {
    writes.push(removeItemP(cs, `${key}:${i}`).catch(() => undefined));
  }
  await Promise.all(writes);
}

async function cloudRead(key: string): Promise<string | null> {
  const cs = cloudStorage();
  if (!cs) throw new Error("CloudStorage not available");
  const meta = await getItemP(cs, key);
  if (!meta) return null;
  const match = meta.match(/^n:(\d+)$/);
  if (!match) {
    // Legacy / un-chunked: treat as full value
    return meta;
  }
  const count = Number(match[1]);
  if (!count) return "";
  const keys = Array.from({ length: count }, (_, i) => `${key}:${i}`);
  const values = await getItemsP(cs, keys);
  return keys.map((k) => values[k] ?? "").join("");
}

function setItemP(cs: CloudStorage, k: string, v: string) {
  return new Promise<void>((res, rej) => cs.setItem(k, v, (e) => (e ? rej(e) : res())));
}
function getItemP(cs: CloudStorage, k: string) {
  return new Promise<string>((res, rej) => cs.getItem(k, (e, v) => (e ? rej(e) : res(v))));
}
function getItemsP(cs: CloudStorage, keys: string[]) {
  return new Promise<Record<string, string>>((res, rej) => cs.getItems(keys, (e, v) => (e ? rej(e) : res(v))));
}
function removeItemP(cs: CloudStorage, k: string) {
  return new Promise<void>((res, rej) => cs.removeItem(k, (e) => (e ? rej(e) : res())));
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
function setGlobal(s: SyncStatus) {
  globalStatus = s;
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

export function useLocalState<T>(key: string, initial: T) {
  const [value, setValueRaw] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usingCloud = useRef<boolean>(false);

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
              setValueRaw(cloudVal);
              localStorage.setItem(key, cloudRaw);
            } catch {}
          } else if (local !== null) {
            // Cloud is empty but we have local data — migrate it up.
            await cloudWrite(key, JSON.stringify(local));
          }
          setStatus("synced"); setGlobal("synced");
        } catch (e) {
          setStatus("offline"); setGlobal("offline");
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

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setStatus("saving"); setGlobal("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await cloudWrite(key, serialized);
        setStatus("synced"); setGlobal("synced");
      } catch {
        setStatus("error"); setGlobal("error");
      }
    }, 400);
  }, [key, value, hydrated]);

  const setValue = (next: T | ((prev: T) => T)) => setValueRaw(next as T);

  return [value, setValue, hydrated, status] as const;
}

// Convenience: read current sync status across known keys (for header indicator).
// Components can call useLocalState to get per-key status; the App can show the
// most-pending one. For simplicity we expose a global event-based listener too.
