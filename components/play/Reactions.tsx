'use client';

import { useCallback, useState } from 'react';

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

export function EmojiBar({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          className="row-press grid h-11 w-11 place-items-center rounded-2xl bg-surface-2 text-2xl"
          aria-label={`React ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
