import type { Config } from 'tailwindcss';

// GNW design system · 3a "Sage Sheet, glass chrome" (Docs/gnw-redesign/tokens).
// Colours read the CSS variables in globals.css, so dark mode is token-only.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  // `hover:` only applies on devices that can really hover, so a tapped row
  // doesn't stay stuck in its hover style on a phone.
  future: { hoverOnlyWhenSupported: true },
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
        // GNW Play: fixed dark ink for text on bright option colours (does NOT
        // flip in dark mode), and the Survival life colour.
        'play-ink': 'rgb(var(--play-ink) / <alpha-value>)',
        'play-heart': 'rgb(var(--play-heart) / <alpha-value>)',
        // 3a: accent swaps in dark (light sage fill), so text ON accent is
        // `text-accent-fg`, never `text-white`. `accent-on` is a legacy alias.
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          fg: 'rgb(var(--accent-fg) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          ink: 'rgb(var(--accent-ink) / <alpha-value>)',
          on: 'rgb(var(--accent-on) / <alpha-value>)',
        },
        // Semantic status colors: the bare name is the fill, `-ink` the text.
        good: { DEFAULT: 'rgb(var(--good) / <alpha-value>)', ink: 'rgb(var(--good-ink) / <alpha-value>)' },
        warn: { DEFAULT: 'rgb(var(--warn) / <alpha-value>)', ink: 'rgb(var(--warn-ink) / <alpha-value>)' },
        bad: { DEFAULT: 'rgb(var(--bad) / <alpha-value>)', ink: 'rgb(var(--bad-ink) / <alpha-value>)' },
        info: { DEFAULT: 'rgb(var(--info) / <alpha-value>)', ink: 'rgb(var(--info-ink) / <alpha-value>)' },
        unread: 'rgb(var(--unread) / <alpha-value>)', // "something new here" dot — orange so it reads against the sage accent
        'glow-top': 'rgb(var(--glow-top) / <alpha-value>)',
        track: 'rgb(var(--track) / <alpha-value>)',
        pinned: 'rgb(var(--pinned) / <alpha-value>)',
        // Event types (EV-C2): text, chip/tile bg, dot.
        type: {
          service: 'rgb(var(--type-service) / <alpha-value>)',
          'service-bg': 'rgb(var(--type-service-bg) / <alpha-value>)',
          'service-dot': 'rgb(var(--type-service-dot) / <alpha-value>)',
          rehearsal: 'rgb(var(--type-rehearsal) / <alpha-value>)',
          'rehearsal-bg': 'rgb(var(--type-rehearsal-bg) / <alpha-value>)',
          'rehearsal-dot': 'rgb(var(--type-rehearsal-dot) / <alpha-value>)',
          prayer: 'rgb(var(--type-prayer) / <alpha-value>)',
          'prayer-bg': 'rgb(var(--type-prayer-bg) / <alpha-value>)',
          'prayer-dot': 'rgb(var(--type-prayer-dot) / <alpha-value>)',
          holytalks: 'rgb(var(--type-holytalks) / <alpha-value>)',
          'holytalks-bg': 'rgb(var(--type-holytalks-bg) / <alpha-value>)',
          'holytalks-dot': 'rgb(var(--type-holytalks-dot) / <alpha-value>)',
          other: 'rgb(var(--type-other) / <alpha-value>)',
          'other-bg': 'rgb(var(--type-other-bg) / <alpha-value>)',
          'other-dot': 'rgb(var(--type-other-dot) / <alpha-value>)',
          encounter: 'rgb(var(--type-encounter) / <alpha-value>)',
          'encounter-bg': 'rgb(var(--type-encounter-bg) / <alpha-value>)',
          'encounter-dot': 'rgb(var(--type-encounter-dot) / <alpha-value>)',
        },
        // Crossover's one celebratory layer: the sage taken down to evergreen,
        // plus gold. Used only on Crossover surfaces (hero, badge, finish line).
        crossover: {
          ever: '#3D4A2E',
          deep: '#222B1A',
          gold: '#C99B45',
          'gold-hi': '#F2DDA4',
          'gold-ink': '#8A6A24',
          champagne: '#F6EEDC',
        },
        // Chat bubbles + canvas (tokens in globals.css → "Chat"). Chat-only.
        chat: {
          mine: 'rgb(var(--chat-mine) / <alpha-value>)',
          'mine-ink': 'rgb(var(--chat-mine-ink) / <alpha-value>)',
          theirs: 'rgb(var(--chat-theirs) / <alpha-value>)',
          'theirs-ink': 'rgb(var(--chat-theirs-ink) / <alpha-value>)',
          canvas: 'rgb(var(--chat-canvas) / <alpha-value>)',
        },
      },
      // Literata (display) + Albert Sans (UI); the stacks live in globals.css.
      fontFamily: {
        sans: ['var(--font-ui)'],
        display: ['var(--font-display)'],
      },
      // 3a radii: buttons/fields 16, cards 22, glass panes 26.
      borderRadius: { xl: '14px', '2xl': '16px', '3xl': '22px', '4xl': '26px', sheet: '28px', dock: '34px' },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-lg': 'var(--shadow-card-lg)',
        sheet: 'var(--shadow-sheet)',
        pop: 'var(--shadow-pop)',
        glow: '0 0 0 0 rgb(94 112 72 / 0.5)',
      },
      transitionTimingFunction: { soft: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      zIndex: { avatar: '30', dock: '40', overlay: '50', lightbox: '60', toast: '70', gate: '100' },
      keyframes: {
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'scale-out': { from: { opacity: '1', transform: 'scale(1)' }, to: { opacity: '0', transform: 'scale(0.96)' } },
        'sheet-down': { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(100%)' } },
        'toast-in': { from: { opacity: '0', transform: 'translateY(12px) scale(0.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        shake: { '0%, 100%': { transform: 'translateX(0)' }, '20%, 60%': { transform: 'translateX(-8px)' }, '40%, 80%': { transform: 'translateX(8px)' } },
        pop: { '0%': { transform: 'scale(1)' }, '45%': { transform: 'scale(1.18)' }, '100%': { transform: 'scale(1)' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        rise: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.92)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'send-in': { from: { opacity: '0', transform: 'scale(0.35)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'enter-home': { from: { opacity: '0', transform: 'translateY(28px) scale(0.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        breathe: { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.04)' } },
        floaty: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
        'pulse-ring': { '0%': { transform: 'scale(0.92)', opacity: '0.55' }, '80%': { opacity: '0' }, '100%': { transform: 'scale(1.9)', opacity: '0' } },
        'typing-dot': { '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.35' }, '30%': { transform: 'translateY(-3px)', opacity: '1' } },
      },
      animation: {
        'fade-out': 'fade-out 0.18s cubic-bezier(0.4, 0, 1, 1) forwards',
        'scale-out': 'scale-out 0.18s cubic-bezier(0.4, 0, 1, 1) forwards',
        'sheet-down': 'sheet-down 0.22s cubic-bezier(0.4, 0, 1, 1) forwards',
        'toast-in': 'toast-in 0.26s cubic-bezier(0.22, 1, 0.36, 1)',
        shake: 'shake 0.4s ease-in-out',
        pop: 'pop 0.32s ease-out',
        'sheet-up': 'sheet-up 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
        rise: 'rise 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        'send-in': 'send-in 0.16s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'enter-home': 'enter-home 0.36s cubic-bezier(0.22, 1, 0.36, 1)',
        breathe: 'breathe 3.5s ease-in-out infinite',
        floaty: 'floaty 4s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 3s cubic-bezier(0.16, 1, 0.3, 1) infinite',
        'typing-dot': 'typing-dot 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
