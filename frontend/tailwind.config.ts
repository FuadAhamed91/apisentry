import type { Config } from "tailwindcss";

/**
 * APISentry design tokens.
 * Dark-only security-operations aesthetic: #090D16 base, deep slate surfaces,
 * subtle white borders, indigo primary / cyan secondary, emerald PASS,
 * crimson critical. Restrained radii and shadows; subtle motion.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#090D16",
        surface: "#0F1521",
        "surface-2": "#151C2A",
        "surface-3": "#1C2534",
        line: "rgba(255,255,255,0.08)",
        "line-strong": "rgba(255,255,255,0.14)",
        fg: "#F8FAFC",
        muted: "#9AA8BE",
        "muted-2": "#64748B",
        indigo: {
          DEFAULT: "#6366F1",
          soft: "#818CF8",
          deep: "#4F46E5",
          fg: "#C7D2FE",
        },
        cyan: { DEFAULT: "#22D3EE", fg: "#A5F3FC" },
        emerald: { DEFAULT: "#10B981", soft: "#34D399", fg: "#6EE7B7" },
        crimson: { DEFAULT: "#F43F5E", soft: "#FB7185", fg: "#FDA4AF" },
        amber: { DEFAULT: "#F59E0B", soft: "#FBBF24", fg: "#FCD34D" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        lg: "0.625rem",
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 10px 30px -18px rgba(0,0,0,0.75)",
        pop: "0 20px 50px -20px rgba(0,0,0,0.8)",
        "glow-indigo": "0 0 0 1px rgba(99,102,241,0.35), 0 10px 32px -10px rgba(99,102,241,0.35)",
        "glow-crimson": "0 0 0 1px rgba(244,63,94,0.35), 0 10px 32px -10px rgba(244,63,94,0.3)",
        "glow-emerald": "0 0 0 1px rgba(16,185,129,0.35), 0 10px 32px -10px rgba(16,185,129,0.3)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "caret-blink": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(99,102,241,0.5)" },
          "70%": { boxShadow: "0 0 0 6px rgba(99,102,241,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(99,102,241,0)" },
        },
        "bar-grow": { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out both",
        "slide-up": "slide-up 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "scale-in": "scale-in 0.2s ease-out both",
        caret: "caret-blink 1s steps(1) infinite",
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
