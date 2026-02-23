import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      'short': { raw: '(max-height: 700px)' },
      xs: "0px",
      sm: '576px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      'hub': { 'raw': '(min-width: 1024px) and (max-height: 650px)' },
      'hub-max': { 'raw': '(min-width: 1280px) and (max-height: 850px)' },
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  safelist: [
    {
      pattern: /(p|px|py|pt|pb|pl|pr)-\d+/,
      variants: ['sm', 'md', 'lg', 'xl'],
    }
  ],
  plugins: [],
} satisfies Config;
