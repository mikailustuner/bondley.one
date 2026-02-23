import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1440px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        positive: "hsl(var(--positive))",
        negative: "hsl(var(--negative))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontSize: {
        "display-xl": ["3.5rem", { lineHeight: "1.05", letterSpacing: "-0.035em", fontWeight: "700" }],
        "display-lg": ["2.75rem", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "700" }],
        "display-md": ["2rem", { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: "600" }],
        "stat": ["1.875rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "600" }],
        "data-lg": ["1.125rem", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
        "data-sm": ["0.8125rem", { lineHeight: "1.5", letterSpacing: "0.01em" }],
        "label": ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.04em", fontWeight: "600" }],
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
