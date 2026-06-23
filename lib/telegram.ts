"use client";

interface TgWebApp {
  ready: () => void;
  expand: () => void;
  HapticFeedback?: { impactOccurred: (s: string) => void };
  switchInlineQuery?: (q: string, targets?: string[]) => void;
  openTelegramLink?: (url: string) => void;
  showAlert?: (msg: string, callback?: () => void) => void;
  showPopup?: (params: { title?: string; message: string; buttons?: { id?: string; type?: string; text?: string }[] }, cb?: (id: string) => void) => void;
  themeParams?: Record<string, string>;
  initData?: string;
}

export function tg(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  // @ts-ignore
  return window.Telegram?.WebApp ?? null;
}

export function isInsideTelegram(): boolean {
  const t = tg();
  return !!(t && t.initData !== undefined);
}

export type ShareResult = "telegram-inline" | "telegram-link" | "browser-tab" | "copied" | "empty";

export async function shareViaTelegram(text: string): Promise<ShareResult> {
  if (!text || !text.trim()) return "empty";

  const t = tg();
  // Inside Telegram: use the native share dialog (works even without inline mode on the bot)
  if (t?.openTelegramLink) {
    const url = `https://t.me/share/url?url=${encodeURIComponent(" ")}&text=${encodeURIComponent(text)}`;
    t.openTelegramLink(url);
    // Also copy as a safety net so user can paste anywhere
    await copyText(text);
    return "telegram-link";
  }
  // Inline mode (if bot supports it)
  if (t?.switchInlineQuery) {
    t.switchInlineQuery(text, ["users", "groups"]);
    return "telegram-inline";
  }
  // Browser fallback: copy to clipboard + open share URL
  const copied = await copyText(text);
  if (typeof window !== "undefined") {
    const url = `https://t.me/share/url?url=${encodeURIComponent(" ")}&text=${encodeURIComponent(text)}`;
    // Use location.href instead of window.open — not popup-blocked
    try { window.open(url, "_blank") || (window.location.href = url); } catch { window.location.href = url; }
  }
  return copied ? "browser-tab" : "browser-tab";
}

/** Confirmation dialog — uses Telegram's native showPopup inside Telegram, window.confirm in browser. */
export function tgConfirm(message: string): Promise<boolean> {
  const t = tg();
  if (t?.showPopup) {
    return new Promise((resolve) => {
      try {
        // Valid Telegram button types: "ok", "close", "destructive", "default"
        t.showPopup!(
          { message, buttons: [{ id: "ok", type: "ok" }, { id: "cancel", type: "close" }] },
          (id: string) => resolve(id === "ok"),
        );
      } catch {
        resolve(typeof window !== "undefined" ? window.confirm(message) : false);
      }
    });
  }
  return Promise.resolve(typeof window !== "undefined" ? window.confirm(message) : false);
}

/** Alert dialog — uses Telegram's native showAlert inside Telegram, window.alert in browser. */
export function tgAlert(message: string): Promise<void> {
  const t = tg();
  if (t?.showAlert) {
    return new Promise((resolve) => {
      try {
        t.showAlert!(message, () => resolve());
      } catch {
        if (typeof window !== "undefined") window.alert(message);
        resolve();
      }
    });
  }
  if (typeof window !== "undefined") window.alert(message);
  return Promise.resolve();
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
