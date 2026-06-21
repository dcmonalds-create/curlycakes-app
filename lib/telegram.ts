"use client";

interface TgWebApp {
  ready: () => void;
  expand: () => void;
  HapticFeedback?: { impactOccurred: (s: string) => void };
  switchInlineQuery?: (q: string, targets?: string[]) => void;
  openTelegramLink?: (url: string) => void;
  showAlert?: (msg: string) => void;
  themeParams?: Record<string, string>;
}

export function tg(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  // @ts-ignore
  return window.Telegram?.WebApp ?? null;
}

export function shareViaTelegram(text: string) {
  const t = tg();
  if (t?.switchInlineQuery) {
    t.switchInlineQuery(text, ["users", "groups"]);
    return;
  }
  // Fallback: open share URL in a new tab
  const url = `https://t.me/share/url?url=${encodeURIComponent(" ")}&text=${encodeURIComponent(text)}`;
  if (typeof window !== "undefined") window.open(url, "_blank");
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
