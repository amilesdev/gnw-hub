'use client';

import { useAudio } from './AudioProvider';
import { Play, Pause } from './Icons';

function fmt(t: number): string {
  if (!Number.isFinite(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Full in-modal transport for the currently-loaded part. Reads the app-wide
 * audio (see AudioProvider) so the same track keeps playing in the MiniPlayer
 * after the song sheet is closed. Renders nothing until a part is playing.
 */
export function AudioPlayer() {
  const { track, playing, current, duration, failed, toggle, seek } = useAudio();
  if (!track) return null;

  return (
    <div className="card grain-block p-4">
      <p className="label mb-3">{track.part}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-white shadow-pop transition active:scale-[0.95]"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause width={22} height={22} /> : <Play width={22} height={22} className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full accent-accent"
            aria-label="Seek"
          />
          <div className="mt-1 flex justify-between text-xs font-semibold text-ink-faint">
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
      {failed && (
        <p className="mt-3 text-xs font-semibold text-rose-500">
          This audio couldn’t be played in your browser.
        </p>
      )}
    </div>
  );
}
