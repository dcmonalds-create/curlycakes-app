"use client";
import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
type ThemePref = Theme | "auto";

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
  // Update Telegram header colors so the chrome blends in.
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
  const [pref, setPref] = useState<ThemePref>("auto");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as ThemePref) || "auto";
    setPref(stored);
    const initial: Theme = stored === "auto" ? detectSystem() : stored;
    setTheme(initial);
    apply(initial);

    // Watch system / Telegram changes when in auto mode
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(KEY) as ThemePref || "auto") === "auto") {
        const t = detectSystem();
        setTheme(t); apply(t);
      }
    };
    mq?.addEventListener?.("change", onChange);
    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    tg?.onEvent?.("themeChanged", onChange);
    return () => {
      mq?.removeEventListener?.("change", onChange);
      tg?.offEvent?.("themeChanged", onChange);
    };
  }, []);

  function cyclePref() {
    const next: ThemePref = pref === "auto" ? "light" : pref === "light" ? "dark" : "auto";
    localStorage.setItem(KEY, next);
    setPref(next);
    const t: Theme = next === "auto" ? detectSystem() : next;
    setTheme(t);
    apply(t);
  }

  return { theme, pref, cyclePref };
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
