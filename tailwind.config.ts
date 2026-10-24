import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: { ink: "#09111f", canvas: "#f5f7fb", cyanx: "#12b8d4", border: "hsl(var(--border))", input: "hsl(var(--input))", ring: "hsl(var(--ring))", background: "hsl(var(--background))", foreground: "hsl(var(--foreground))", primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" }, secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" }, muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" }, accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" }, card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" }, sidebar: { DEFAULT: "hsl(var(--sidebar))", foreground: "hsl(var(--sidebar-foreground))", primary: "hsl(var(--sidebar-primary))", "primary-foreground": "hsl(var(--sidebar-primary-foreground))", accent: "hsl(var(--sidebar-accent))", "accent-foreground": "hsl(var(--sidebar-accent-foreground))", border: "hsl(var(--sidebar-border))", ring: "hsl(var(--sidebar-ring))" } }, borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" }, boxShadow: { soft: "0 10px 30px rgba(15, 23, 42, .06)" } } },
  plugins: []
};
export default config;
