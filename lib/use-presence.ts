'use client';

import { useEffect, useState } from 'react';

/**
 * Keeps something mounted for `exitMs` after `open` turns false, so it can play
 * its exit animation (sheet-down, scale-out, fade-out) before it unmounts.
 * `closing` is true during that window.
 */
export function usePresence(open: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return { mounted: open || mounted, closing: !open && mounted };
}
