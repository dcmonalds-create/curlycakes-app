import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg:     "rgb(var(--bg) / <alpha-value>)",
        ink:    "rgb(var(--ink) / <alpha-value>)",
        muted:  "rgb(var(--muted) / <alpha-value>)",
        subtle: "rgb(var(--subtle) / <alpha-value>)",
        line:   "rgb(var(--line) / <alpha-value>)",
        warn:   "rgb(var(--warn) / <alpha-value>)",
        good:   "rgb(var(--good) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          "2":     "rgb(var(--surface-2) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          "2":     "rgb(var(--accent-2) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "'DM Serif Display'", "Georgia", "serif"],
        sans:    ["'Manrope'", "'SF Pro Text'", "system-ui", "sans-serif"],
        mono:    ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgb(var(--line) / 1), 0 12px 32px -16px rgb(var(--ink) / 0.18)",
        pop:  "0 24px 60px -24px rgb(var(--ink) / 0.35)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
