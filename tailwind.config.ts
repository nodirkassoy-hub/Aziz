import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        brand: {
          50: "#eefbf6", 100: "#d6f5e8", 200: "#b0e9d5", 300: "#7ad7bc",
          400: "#40bd9e", 500: "#1a9e83", 600: "#0f7f6c", 700: "#0d6558",
          800: "#0e5047", 900: "#0d423c", 950: "#04261f",
        },
        ink: {
          50: "#f6f7fa", 100: "#eceef4", 200: "#d8dce8", 300: "#b5bccf",
          400: "#8b95b3", 500: "#6a7598", 600: "#545e7e", 700: "#444c67",
          800: "#3b4156", 900: "#232738", 950: "#12141f",
        },
      },
      boxShadow: {
        glass: "0 1px 2px rgba(16,24,40,.04), 0 8px 32px -8px rgba(16,24,40,.12)",
        "glass-lg": "0 2px 4px rgba(16,24,40,.05), 0 24px 64px -16px rgba(16,24,40,.22)",
        lift: "0 4px 12px -2px rgba(16,24,40,.10), 0 16px 40px -12px rgba(16,24,40,.18)",
      },
      keyframes: {
        fadeUp: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        scaleIn: { "0%": { opacity: "0", transform: "scale(.97)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-up": "fadeUp .35s cubic-bezier(.21,1.02,.55,1) both",
        "fade-in": "fadeIn .25s ease both",
        "scale-in": "scaleIn .2s cubic-bezier(.21,1.02,.55,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
