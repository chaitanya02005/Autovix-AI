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
          sidebarActive: "#1e3a8a",
          bg: "#F8FAFC",
          surface: "#FFFFFF",
          ink: "#0f172a",
          inkLight: "#334155",
          muted: "#64748b",
          mutedLight: "#94a3b8",
          border: "#e2e8f0",
          borderStrong: "#cbd5e1",
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
