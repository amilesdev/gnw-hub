'use client';

import { useEffect, useState } from 'react';

export type ViewportBox = { top: number; height: number; keyboard: number };

/**
 * The visual viewport's box (shrinks when the on-screen keyboard opens). Full
 * screen chat layers size themselves to it so what's at the bottom — the
 * composer, the end of a results list — rides above the iOS keyboard.
 */
export function useVisualViewportBox(): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setBox({ top: vv.offsetTop, height: vv.height, keyboard: Math.max(0, window.innerHeight - vv.height) });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return box;
}
