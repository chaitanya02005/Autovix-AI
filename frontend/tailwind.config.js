/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          sidebar: "#0b1120",
          sidebarBorder: "#1e293b",
          sidebarActive: "#1e293b",
          bg: "#F8FAFC",
          surface: "#FFFFFF",
          ink: "#0f172a",
          inkLight: "#334155",
          muted: "#64748b",
          mutedLight: "#94a3b8",
          border: "#e2e8f0",
          borderStrong: "#cbd5e1",
          accent: "#2563eb",
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'sm': '6px',
        'md': '8px',
        'lg': '10px',
        'xl': '12px',
      }
    },
  },
  plugins: [],
}
