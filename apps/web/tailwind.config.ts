import type { Config } from "tailwindcss";
import {
  axonaBorderRadius,
  axonaColors,
  axonaFontFamily,
} from "@axona/config";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    // Replace the default palette so ONLY token-backed color utilities exist.
    colors: axonaColors,
    extend: {
      fontFamily: axonaFontFamily,
      borderRadius: axonaBorderRadius,
    },
  },
  plugins: [],
};

export default config;
