'use client';

// Survival lives. Replaces the emoji string ('❤️'.repeat(n) / 💀) that used to
// carry this state.
//
// Three reasons this is a component and not text:
//  1. Emoji render differently on every OS and ignore the theme.
//  2. Losing a heart is the most emotional beat in Survival and a string can't
//     animate it — here the heart that was just spent flares and breaks.
//  3. State reads from the icon's SHAPE (filled vs outline) plus a text label,
//     never from colour alone.

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Heart } from '@/components/shared/Icons';

const TOTAL = 3;

export function Hearts({
  hearts,
  eliminated = false,
  size = 16,
  className,
}: {
  hearts: number;
  eliminated?: boolean;
  size?: number;
  className?: string;
}) {
  // Index of the heart that was spent on the most recent change, so only that
  // one plays the break animation.
  const prev = useRef(hearts);
  const [breaking, setBreaking] = useState<number | null>(null);

  useEffect(() => {
    if (hearts < prev.current) {
      setBreaking(hearts);
      const t = setTimeout(() => setBreaking(null), 620);
      prev.current = hearts;
      return () => clearTimeout(t);
    }
    prev.current = hearts;
  }, [hearts]);

  const label = eliminated ? 'Out of the game' : `${hearts} of ${TOTAL} lives left`;

  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-label={label} role="img">
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: TOTAL }).map((_, i) => {
          const held = i < hearts && !eliminated;
          return (
            <Heart
              key={i}
              filled={held}
              width={size}
              height={size}
              className={cn(
                'transition-opacity',
                held ? 'text-play-heart' : 'text-ink-faint opacity-50',
                breaking === i && 'play-heart-break',
              )}
            />
          );
        })}
      </span>
      {eliminated && (
        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-faint">Out</span>
      )}
    </span>
  );
}
