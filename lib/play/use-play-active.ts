'use client';

import { useEffect } from 'react';

// Marks the document as "in Play mode" so global chrome (the paper grain) is
// suppressed for the gamified screens. Removed automatically on unmount.
// Pass `active=false` to hold off — the Enter gate keeps the native grain until
// the player actually crosses the threshold into game mode.
export function usePlayActive(active: boolean = true): void {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.classList.add('play-active');
    return () => root.classList.remove('play-active');
  }, [active]);
}
