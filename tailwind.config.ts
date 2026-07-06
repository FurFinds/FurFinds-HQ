import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "ff-dark-blue": "#395EA1",
        "ff-light-blue": "#88C7E8",
        "ff-pale-blue": "#D3EEFF",
        "ff-gold": "#C9A84C",
        "ff-silver": "#A8A8A8",
        "ff-bronze": "#A97142",
        "ff-success": "#22C55E",
        "ff-warning": "#F59E0B",
        "ff-error": "#EF4444",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(57, 94, 161, 0.1), 0 1px 2px -1px rgba(57, 94, 161, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
