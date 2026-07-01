import type { Config } from 'tailwindcss';

// GNW design system — ported verbatim from Docs/GNW-Apps-Hub.md §9.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: 'rgb(var(--app-bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--ink-soft) / <alpha-value>)',
        'ink-faint': 'rgb(var(--ink-faint) / <alpha-value>)',
        accent: {
          DEFAULT: '#5E7048',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          ink: '#4A5938',
          on: '#AEBE8A',
        },
        // Semantic status colors — generic; alias per app as needed.
        good: '#5E7048', // success / positive
        warn: '#C58A3D', // warning / caution
        bad: '#B4544E', // error / negative
        info: '#6E7FA0', // neutral / informational
      },
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'system-ui', 'sans-serif'],
        display: ['var(--font-fraunces)', 'Georgia', 'Cambria', 'serif'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      boxShadow: {
        card: '0 1px 2px rgb(20 14 30 / 0.04), 0 10px 30px -14px rgb(20 14 30 / 0.16)',
        'card-lg': '0 2px 4px rgb(20 14 30 / 0.05), 0 20px 50px -20px rgb(20 14 30 / 0.28)',
        sheet: '0 -10px 50px -10px rgb(20 14 30 / 0.3)',
        pop: '0 10px 28px -10px rgb(74 89 56 / 0.45)',
        glow: '0 0 0 0 rgb(94 112 72 / 0.5)',
      },
      keyframes: {
        shake: { '0%, 100%': { transform: 'translateX(0)' }, '20%, 60%': { transform: 'translateX(-8px)' }, '40%, 80%': { transform: 'translateX(8px)' } },
        pop: { '0%': { transform: 'scale(1)' }, '45%': { transform: 'scale(1.18)' }, '100%': { transform: 'scale(1)' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        rise: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.92)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'enter-home': { from: { opacity: '0', transform: 'translateY(28px) scale(0.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        breathe: { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.04)' } },
        floaty: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
        'pulse-ring': { '0%': { transform: 'scale(0.92)', opacity: '0.55' }, '80%': { opacity: '0' }, '100%': { transform: 'scale(1.9)', opacity: '0' } },
      },
      animation: {
        shake: 'shake 0.4s ease-in-out',
        pop: 'pop 0.32s ease-out',
        'sheet-up': 'sheet-up 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
        rise: 'rise 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        'enter-home': 'enter-home 0.36s cubic-bezier(0.22, 1, 0.36, 1)',
        breathe: 'breathe 3.5s ease-in-out infinite',
        floaty: 'floaty 4s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 3s cubic-bezier(0.16, 1, 0.3, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
