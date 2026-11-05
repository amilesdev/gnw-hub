'use client';

import { useEffect, useState } from 'react';
import { isTypingTarget } from '@/lib/keyboard';

export type ViewportBox = { top: number; height: number; keyboard: number };

/**
 * The visual viewport's box (shrinks when the on-screen keyboard opens). Full
 * screen chat layers size themselves to it so what's at the bottom — the
 * composer, the end of a results list — rides above the iOS keyboard.
 *
 * Null whenever nobody is typing, so the layer falls back to full screen. iOS
 * sometimes never sends the "keyboard closed" resize, and a stale reading left
 * the composer stranded halfway up with an empty gap below it.
 */
export function useVisualViewportBox(): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const timers: number[] = [];
    const update = () => {
      if (!isTypingTarget(document.activeElement)) {
        setBox(null);
        return;
      }
      setBox({ top: vv.offsetTop, height: vv.height, keyboard: Math.max(0, window.innerHeight - vv.height) });
    };
    // Focus changes and returning to the app fire before iOS has finished
    // animating the keyboard, so measure again once it has settled.
    const settle = () => {
      update();
      timers.push(window.setTimeout(update, 150), window.setTimeout(update, 450));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', settle);
    document.addEventListener('focusout', settle);
    document.addEventListener('visibilitychange', settle);
    window.addEventListener('pageshow', settle);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', settle);
      document.removeEventListener('focusout', settle);
      document.removeEventListener('visibilitychange', settle);
      window.removeEventListener('pageshow', settle);
    };
  }, []);
  return box;
}
