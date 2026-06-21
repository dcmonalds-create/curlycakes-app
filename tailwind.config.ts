import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF8F4",
        rose: {
          50: "#FFF1F4",
          100: "#FFE0E7",
          200: "#FFC4D2",
          300: "#FF9DB6",
          400: "#FF7197",
          500: "#F54B7E",
          600: "#D93268",
          700: "#A91F4F",
        },
      },
      fontFamily: {
        display: ["'Playfair Display'", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 8px 24px -8px rgba(245, 75, 126, 0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
