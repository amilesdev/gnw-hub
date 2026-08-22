'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

// Standard reaction set (spec §4.4).
export const EMOJIS = ['🎉', '😂', '🔥', '❤️', '👀', '😮'];

interface Floating {
  id: number;
  emoji: string;
  left: number; // vw position
}

let counter = 0;

/** Manages the transient list of floating reaction emojis. */
export function useReactionList() {
  const [floats, setFloats] = useState<Floating[]>([]);

  const spawn = useCallback((emoji: string) => {
    const id = counter++;
    const left = 15 + Math.random() * 60;
    setFloats((f) => [...f, { id, emoji, left }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 2400);
  }, []);

  return { floats, spawn };
}

export function ReactionLayer({ floats }: { floats: { id: number; emoji: string; left: number }[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {floats.map((f) => (
        <span
          key={f.id}
          className="play-reaction absolute bottom-24 text-4xl"
          style={{ left: `${f.left}%` }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}

/**
 * `tone` exists because this bar sits on two different grounds. On the lobby it
 * lives on the themed app surface; on the live game it sits on the stage, which
 * is dark in BOTH themes — and `bg-surface-2` there rendered six cream discs on
 * a near-black stage in light mode, the one place the stage didn't hold.
 */
export function EmojiBar({
  onPick,
  tone = 'surface',
}: {
  onPick: (emoji: string) => void;
  tone?: 'surface' | 'stage';
}) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          className={cn(
            'grid h-11 w-11 place-items-center rounded-2xl text-2xl transition active:scale-95',
            tone === 'stage' ? 'bg-white/10 active:bg-white/20' : 'row-press bg-surface-2',
          )}
          aria-label={`React ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
