/**
 * Tiny haptics helper built on the Web Vibration API.
 *
 * Reserve these for *decisions and state changes* — a vote cast, an answer
 * locked in, a destructive confirm — never on every tap or scroll, or the
 * feedback becomes noise and stops meaning anything.
 *
 * Platform note: `navigator.vibrate` fires on Android/Chrome but is a no-op on
 * iOS Safari and iOS PWAs (Apple doesn't expose it to the web). Every call is
 * guarded so it degrades silently everywhere. If richer iPhone haptics ever
 * become non-negotiable, the app needs a native shell (e.g. Capacitor) — this
 * helper is the seam where that would plug in.
 */

type Pattern = number | number[];

function fire(pattern: Pattern) {
  if (typeof window === 'undefined') return;
  const nav = window.navigator;
  if (typeof nav?.vibrate !== 'function') return;
  // Respect users who've asked the OS to reduce motion/feedback.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  try {
    nav.vibrate(pattern);
  } catch {
    /* some browsers throw when called without a user gesture — ignore */
  }
}

/** Light confirmation for a committed action (vote cast, answer submitted). */
export function tap() {
  fire(12);
}

/** A meatier press — hold-to-enter completion, primary commit. */
export function press() {
  fire(24);
}

/** Success cadence — a game finishing, an invite claimed. */
export function success() {
  fire([14, 40, 22]);
}

/** Warning/soft-error cadence — a destructive confirm, a rejected action. */
export function warn() {
  fire([28, 50, 28]);
}

export const haptics = { tap, press, success, warn };
