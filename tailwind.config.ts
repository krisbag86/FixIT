import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        paper: "#f7f5ef",
        mint: "#1f8a70",
        berry: "#b83280",
        amberline: "#e6a700",
        river: "#2f6fed",
        neon: {
          green: "#00ff88",
          blue: "#00b4ff",
          purple: "#a855f7",
          amber: "#ffb700"
        }
      },
      boxShadow: {
        soft: "0 16px 50px rgba(15, 23, 42, 0.10)",
        glow: "0 0 20px rgba(31, 138, 112, 0.25)",
        "glow-lg": "0 0 40px rgba(31, 138, 112, 0.30)",
        "glow-blue": "0 0 20px rgba(47, 111, 237, 0.25)",
        inner: "inset 0 2px 4px rgba(0,0,0,0.05)"
      },
      spacing: {
        "13": "3.25rem"
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 3s linear infinite"
      }
    }
  },
  plugins: []
};

export default config;
