import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#05060A",
        plate: "#0B0D14",
        line: "#1A1D2A",
        neon: {
          cyan: "#22E8FF",
          purple: "#B26BFF",
          pink: "#FF4FA3",
          green: "#3DFFC8",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(178, 107, 255, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
