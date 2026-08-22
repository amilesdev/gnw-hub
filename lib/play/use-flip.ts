'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * FLIP reordering for the live standings.
 *
 * When the leaderboard changes, rows previously hard-swapped into their new
 * positions — the one moment in the game where you most want to SEE someone
 * pass you, and it happened between frames.
 *
 * First / Last / Invert / Play: remember where each row was, let React paint
 * the new order, measure where it landed, jump it back to the old spot with a
 * transform, then release. Only `transform` animates, so this never triggers
 * layout on the hottest screen in the app.
 *
 * Usage:
 *   const flip = useFlip([leaderboard.map(e => e.playerId).join()]);
 *   <div ref={flip('some-id')} className="play-flip">…</div>
 */
export function useFlip(deps: unknown[]) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const prev = useRef(new Map<string, number>());

  const ref = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(key, el);
      else nodes.current.delete(key);
    },
    [],
  );

  useLayoutEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, number>();

    nodes.current.forEach((el, key) => {
      const top = el.getBoundingClientRect().top;
      next.set(key, top);

      const before = prev.current.get(key);
      // A row that wasn't on screen last time has nothing to travel from.
      if (reduce || before === undefined) return;

      const delta = before - top;
      if (Math.abs(delta) < 1) return;

      // Invert: snap back to where it was, with transitions off…
      el.style.transition = 'none';
      el.style.transform = `translateY(${delta}px)`;
      // …then release on the next frame so the class's transition runs.
      requestAnimationFrame(() => {
        el.style.transition = '';
        el.style.transform = '';
      });
    });

    prev.current = next;
    // Caller passes a signature of the order (see doc comment above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
