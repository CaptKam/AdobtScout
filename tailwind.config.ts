import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  safelist: [
    // Leaflet marker classes that are dynamically generated in HTML strings
    // Sizes
    "w-8", "h-8", "w-14", "h-14", "w-16", "h-16", "w-20", "h-20", "w-24", "h-24",
    "w-full", "h-full",
    // Borders
    "rounded-full", "rounded-2xl",
    "border-2", "border-4", "border-white", "border-primary", "dark:border-card",
    // Backgrounds and gradients
    "bg-white", "bg-blue-600", "bg-green-500", "bg-red-500", "bg-orange-500", "bg-black/60",
    "bg-gradient-to-br", "bg-gradient-to-t",
    "from-blue-500", "to-blue-600", "from-primary", "to-primary/80",
    "from-rose-500", "to-pink-600", "from-primary/20", "to-primary/5",
    "from-black/60", "via-transparent", "to-transparent",
    // Shadows
    "shadow-lg", "shadow-xl", "shadow-2xl", "shadow-3xl", "group-hover:shadow-3xl",
    // Animations
    "animate-pulse", "animate-ping",
    // Hover and transitions
    "hover:scale-110", "hover:scale-125", "hover:brightness-110",
    "group-hover:scale-110", "group-hover:scale-125", "group-hover:opacity-100", "group-hover:brightness-110", "group-hover:z-50",
    "transition-all", "transition-transform", "transition-opacity",
    "duration-200", "duration-300",
    // Cursors
    "cursor-pointer", "cursor-move",
    // Layout
    "flex", "items-center", "justify-center",
    "absolute", "relative", "inset-0",
    "overflow-hidden", "object-cover",
    // Positioning
    "-top-2", "-right-2", "-bottom-2", "-bottom-6",
    "left-1/2", "transform", "-translate-x-1/2",
    "bottom-1", "left-1", "right-1",
    // Text
    "text-xs", "text-2xl", "font-bold",
    "text-white", "text-primary", "text-center",
    "truncate", "whitespace-nowrap",
    // Spacing
    "px-1", "px-2", "py-0.5", "py-1",
    // Opacity and z-index
    "opacity-0", "opacity-50", "z-50",
    // Pointer events
    "pointer-events-none",
    // Group
    "group",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: ".75rem", /* 12px */
        md: ".5rem", /* 8px */
        sm: ".25rem", /* 4px */
      },
      colors: {
        // Flat / base colors (regular buttons)
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)"
        },
        status: {
          online: "rgb(34 197 94)",
          away: "rgb(245 158 11)",
          busy: "rgb(239 68 68)",
          offline: "rgb(156 163 175)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        heading: ["var(--font-heading)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        wag: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(10deg)" },
        },
        pop: {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        wag: "wag 0.6s ease-in-out infinite",
        pop: "pop 0.18s ease-out both",
        slideUp: "slideUp 0.22s ease-out both",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
