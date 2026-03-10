/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f8ff",
          100: "#dceeff",
          500: "#0b6fa4",
          700: "#084f75",
          900: "#062f45"
        }
      }
    }
  },
  plugins: []
};
