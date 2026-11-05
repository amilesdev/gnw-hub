'use client';

import { useEffect } from 'react';
import { isTypingTarget } from '@/lib/keyboard';

/**
 * Marks `<html>` with `kb-open` while someone is typing on a touch screen, so
 * the bottom nav steps aside (globals.css) instead of riding up on the keyboard
 * and fighting it for space. Also undoes the page shift iOS leaves behind: it
 * scrolls the whole document up to reveal a field and doesn't always scroll it
 * back once the keyboard closes.
 */
export function KeyboardWatcher() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const root = document.documentElement;
    let timer = 0;
    const sync = () => {
      window.clearTimeout(timer);
      // Hopping from one field to the next fires focusout then focusin; wait a
      // beat so the nav doesn't flash back in between.
      timer = window.setTimeout(() => {
        const typing = isTypingTarget(document.activeElement);
        root.classList.toggle('kb-open', typing);
        if (!typing && (window.scrollY || root.scrollTop)) window.scrollTo(0, 0);
      }, 80);
    };
    sync();
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', sync);
      document.removeEventListener('visibilitychange', sync);
      root.classList.remove('kb-open');
    };
  }, []);
  return null;
}
