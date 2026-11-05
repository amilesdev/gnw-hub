'use client';

import { useEffect, useRef } from 'react';

/**
 * Give a full-screen chat layer (photo viewer, emoji picker) its own history
 * entry while it's open, so the iOS edge swipe / Android back / browser Back
 * closes the layer instead of backing out of the chat underneath. Same approach
 * as the shared Overlay. Pushed on a timer so React's dev double mount doesn't
 * strand an extra entry.
 */
export function useBackClose(onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;

  useEffect(() => {
    const token = Math.random().toString(36).slice(2);
    const href = window.location.href;
    let pushed = false;
    let popped = false;
    const timer = window.setTimeout(() => {
      window.history.pushState({ gnwChatLayer: token }, '');
      pushed = true;
    }, 0);
    const onPopState = () => {
      if (!pushed || popped || window.history.state?.gnwChatLayer === token) return;
      popped = true;
      ref.current();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('popstate', onPopState);
      // Closed from inside (X, a pick): drop our entry so the next back lands where it should.
      if (pushed && !popped && window.history.state?.gnwChatLayer === token && window.location.href === href) {
        window.history.back();
      }
    };
  }, []);
}
