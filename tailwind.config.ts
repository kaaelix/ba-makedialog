import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ba: {
          dark: "#0b1219",
          card: "#121d27",
          cardHover: "#172533",
          surface: "#0d1620",
          border: "#1e2e3d",
          accent: "#208bfe",
          cyan: "#7accf9",
          navy: "#112536",
          stroke: "#2b435b",
          gold: "#eab308",
        },
      },
    },
  },
  plugins: [],
};

export default config;
