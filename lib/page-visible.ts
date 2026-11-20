/**
 * True when the app is on screen. Background polling loops skip their tick when
 * this is false, so an app left open in a background tab / suspended PWA doesn't
 * keep hitting the server (each hit costs Vercel CPU on the Hobby plan).
 */
export function pageVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

// Returning to the app usually fires both `visibilitychange` and `focus` back to
// back; collapse them into a single call.
const RETURN_DEDUPE_MS = 2_000;

/**
 * Run `fn` whenever the app comes back on screen — tab/PWA becoming visible, or
 * the window regaining focus (desktop window switches don't change visibility).
 * Both events usually fire together, so calls within 2s collapse into one.
 * Returns an unsubscribe. Callers should NOT add their own focus listener.
 */
export function onPageVisible(fn: () => void): () => void {
  let last = 0;
  const handler = () => {
    if (!pageVisible()) return;
    const now = Date.now();
    if (now - last < RETURN_DEDUPE_MS) return;
    last = now;
    fn();
  };
  document.addEventListener('visibilitychange', handler);
  window.addEventListener('focus', handler);
  return () => {
    document.removeEventListener('visibilitychange', handler);
    window.removeEventListener('focus', handler);
  };
}
