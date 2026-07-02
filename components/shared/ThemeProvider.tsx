'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'system' | 'dark';

const STORAGE_KEY = 'gnw-theme';
const LIGHT_BAR = '#FAF7F2';
const DARK_BAR = '#161410';

/** Resolve a preference to whether dark should be active right now. */
function resolveDark(pref: ThemePreference): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Flip the html.dark class and retint the status bar to match. */
function applyTheme(pref: ThemePreference): void {
  const dark = resolveDark(pref);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', dark ? DARK_BAR : LIGHT_BAR);
  });
}

const ThemeContext = createContext<{
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
}>({ theme: 'system', setTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Theme state + persistence. The initial paint is handled by the inline
 * ThemeScript below (pre-hydration, so there's never a light flash); this
 * provider takes over from there for toggling and OS-preference changes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start from 'system' on the server; the real preference is read after mount
  // (matches what ThemeScript already painted, so nothing visibly changes).
  const [theme, setThemeState] = useState<ThemePreference>('system');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') setThemeState(saved);
    } catch {
      /* storage unavailable — stay on system */
    }
  }, []);

  // Follow live OS changes while in system mode.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((t: ThemePreference) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* private mode etc. — theme still applies for this visit */
    }
    applyTheme(t);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

/**
 * Inline, render-blocking script that applies the saved theme before first
 * paint. Rendered at the top of <body> so neither a light flash nor a
 * hydration mismatch is possible (it only touches <html> and <meta>).
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);var c=d?'${DARK_BAR}':'${LIGHT_BAR}';document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',c);});}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
