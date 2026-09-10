import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        space: "#05070B",
        deep: "#123A5E",
        moss: "#1F4A3F",
        sand: "#F3EFE7",
        gold: "#9C7B3C",
        ink: "#111820",
        mute: "#5B6570",
      },
      fontFamily: {
        display: ["'Cinzel'", "serif"],
        serif: ["'Playfair Display'", "serif"],
        sans: ["'Montserrat'", "sans-serif"],
      },
      fontSize: {
        h1: "clamp(38px, 6vw, 76px)",
        h2: "clamp(26px, 3.4vw, 44px)",
      },
      letterSpacing: {
        widest2: "0.2em",
        label: "0.05em",
      },
      transitionTimingFunction: {
        silk: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
