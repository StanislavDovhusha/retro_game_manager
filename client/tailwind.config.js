/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI Variable"', '"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'],
        mono: ['"Cascadia Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // Корпус консоли (светлая тема) и экран (тёмная тема)
        shell: { 50: '#f4f5f7', 100: '#eceef2', 200: '#dde0e7', 300: '#c6cad4', 400: '#9aa1b1', 500: '#6f778a', 600: '#515869', 700: '#3a4050', 800: '#252a36', 900: '#181b24', 950: '#101218' },
        // Акцент — цвет кнопок A/B
        btn: { 50: '#fdf1f5', 100: '#fbe1ea', 400: '#e0517f', 500: '#cf2f62', 600: '#b02253', 700: '#8f1b44' },
      },
    },
  },
  plugins: [],
};
