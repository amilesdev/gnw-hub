'use client';

import { useAudio } from './AudioProvider';
import { Play, Pause, X } from './Icons';

/**
 * Persistent transport bar. Sits flush above the tab bar whenever a part is
 * playing, so a member can keep a track running while they browse the setlist.
 * Full-screen overlays (z-50 portals) cover it, so it never fights the song
 * modal — it re-appears the moment the modal closes.
 */
export function MiniPlayer() {
  const { track, playing, current, duration, failed, toggle, seek, stop } = useAudio();
  if (!track) return null;

  return (
    <div className="no-print shrink-0 border-t border-line bg-app/95 px-3 pb-1 pt-2 backdrop-blur">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2 shadow-card">
        <button
          type="button"
          onClick={toggle}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white shadow-pop transition active:scale-[0.95]"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause width={18} height={18} /> : <Play width={18} height={18} className="ml-0.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-sm font-semibold">{track.title}</span>
            <span className="shrink-0 text-xs text-ink-faint">· {track.part}</span>
          </div>
          {failed ? (
            <p className="mt-0.5 text-xs font-semibold text-bad">Couldn’t play this audio.</p>
          ) : (
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={current}
              onChange={(e) => seek(Number(e.target.value))}
              className="mt-1 w-full accent-accent"
              aria-label="Seek"
            />
          )}
        </div>

        <button
          type="button"
          onClick={stop}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint transition active:scale-[0.9]"
          aria-label="Stop playback"
        >
          <X width={18} height={18} />
        </button>
      </div>
    </div>
  );
}
