"use client";
import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "cc:theme";

function detectSystem(): Theme {
  if (typeof window === "undefined") return "light";
  // Telegram passes color scheme via WebApp.colorScheme — prefer it inside TG.
  // @ts-ignore
  const tg = window.Telegram?.WebApp;
  if (tg?.colorScheme === "dark" || tg?.colorScheme === "light") return tg.colorScheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("theme-light", "theme-dark");
  root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
  root.style.colorScheme = theme;
  // @ts-ignore
  const tg = window.Telegram?.WebApp;
  if (tg?.setHeaderColor) {
    try {
      tg.setHeaderColor(theme === "dark" ? "#181015" : "#FBF7F4");
      tg.setBackgroundColor?.(theme === "dark" ? "#181015" : "#FBF7F4");
    } catch {}
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Load saved preference, or fall back to the system / Telegram theme on first run.
    const stored = localStorage.getItem(KEY);
    const initial: Theme = stored === "light" || stored === "dark" ? stored : detectSystem();
    setTheme(initial);
    apply(initial);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, next);
    setTheme(next);
    apply(next);
  }

  return { theme, toggle };
}

/* Keep the focused input visible above the on-screen keyboard.
   Telegram's `viewportChanged` fires when the keyboard shows/hides on iOS. */
export function useKeyboardAvoidance() {
  useEffect(() => {
    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    tg?.expand?.();

    function scrollFocused() {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return;
      // Defer so layout has settled
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }

    document.addEventListener("focusin", scrollFocused);
    tg?.onEvent?.("viewportChanged", scrollFocused);
    window.visualViewport?.addEventListener?.("resize", scrollFocused);

    return () => {
      document.removeEventListener("focusin", scrollFocused);
      tg?.offEvent?.("viewportChanged", scrollFocused);
      window.visualViewport?.removeEventListener?.("resize", scrollFocused);
    };
  }, []);
}
