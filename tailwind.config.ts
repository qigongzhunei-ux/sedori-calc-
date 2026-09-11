import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        profit: {
          light: "#ecfdf5",
          DEFAULT: "#059669",
          dark: "#047857",
        },
        loss: {
          light: "#fef2f2",
          DEFAULT: "#dc2626",
          dark: "#b91c1c",
        },
      },
    },
  },
  plugins: [],
};
export default config;
