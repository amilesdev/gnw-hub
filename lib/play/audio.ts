'use client';

// Lightweight SFX player. Files live in /public/sounds (see the audio manifest).
// Missing files fail silently, so the game works before assets are dropped in.
const cache = new Map<string, HTMLAudioElement>();

export type Sfx =
  | 'lobby-music'
  | 'game-start'
  | 'countdown-tick'
  | 'countdown-final'
  | 'round-end'
  | 'answer-correct'
  | 'answer-wrong'
  | 'heart-lost'
  | 'elimination'
  | 'celebration-music'
  | 'podium-land';

export function playSfx(name: Sfx, opts?: { loop?: boolean; volume?: number }): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  try {
    let el = cache.get(name);
    if (!el) {
      el = new Audio(`/sounds/${name}.mp3`);
      cache.set(name, el);
    }
    el.loop = opts?.loop ?? false;
    el.volume = opts?.volume ?? 1;
    el.currentTime = 0;
    void el.play().catch(() => {});
    return el;
  } catch {
    return null;
  }
}

export function stopSfx(name: Sfx): void {
  const el = cache.get(name);
  if (el) {
    el.pause();
    el.currentTime = 0;
  }
}
