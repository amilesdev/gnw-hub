'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SongDTO } from '@/lib/setlist-serialize';
import { useAudio, type SongSheetContext } from './AudioProvider';
import { Play, Pause, RotateCcw, Repeat } from './Icons';
import { cn } from '@/lib/utils';

export const clock = (t: number) => {
  if (!Number.isFinite(t) || t < 0) return '0:00';
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
};

/** A part file's length, read from its metadata only (no full download). */
function useDuration(src: string | null) {
  const [d, setD] = useState<number | null>(null);
  useEffect(() => {
    if (!src) return;
    const a = new Audio();
    a.preload = 'metadata';
    const done = () => Number.isFinite(a.duration) && setD(a.duration);
    a.addEventListener('loadedmetadata', done);
    a.src = src;
    return () => {
      a.removeEventListener('loadedmetadata', done);
      a.removeAttribute('src');
      a.load();
    };
  }, [src]);
  return d;
}

const BARS = 46;

/** Decorative waveform heights (not real amplitude), seeded from the file so
 *  the same part always draws the same shape. */
function waveform(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Array.from({ length: BARS }, (_, i) => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ i;
    const r = ((h >>> 0) % 1000) / 1000;
    // A gentle swell in the middle so it reads like a song, not noise.
    const swell = 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / BARS);
    return Math.max(0.18, Math.min(1, 0.25 + r * 0.75 * swell));
  });
}

/**
 * One part in the song sheet (SG-C1): idle, not uploaded, or the active row
 * with the inline player (play/pause, restart, loop, a waveform scrubber).
 * The active row mirrors the app-wide audio, so reopening a sheet whose part
 * is still playing shows it active. `trailing` is the editor's slot (Upload).
 */
export function PartRow({
  id,
  label,
  src,
  song,
  context,
  mine = false,
  trailing,
  below,
}: {
  id: string;
  label: string;
  src: string | null;
  song: SongDTO;
  context?: SongSheetContext;
  mine?: boolean;
  trailing?: ReactNode;
  below?: ReactNode;
}) {
  const { track, playing, current, duration, failed, loop, play, toggle, seek, restart, toggleLoop } = useAudio();
  const active = !!src && track?.id === id;
  const fileDuration = useDuration(active ? null : src);
  const bars = useMemo(() => waveform(src ?? id), [src, id]);

  if (!active) {
    return (
      <div>
        <div
          className={cn(
            'flex min-h-14 items-center gap-3 rounded-[18px] border border-line bg-surface p-2 pr-3',
            src && 'transition duration-150 active:scale-[0.985]',
          )}
        >
          {src ? (
            <button
              type="button"
              onClick={() => play({ id, src, title: song.songTitle, part: label, song, context })}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              aria-label={`Play ${label}`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink">
                <Play width={15} height={15} className="ml-0.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{label}</span>
              <span className="shrink-0 text-[13px] tabular-nums text-ink-faint">
                {fileDuration !== null ? clock(fileDuration) : ''}
              </span>
            </button>
          ) : (
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span className="h-10 w-10 shrink-0 rounded-full border-[1.5px] border-dashed border-ink-faint" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-base font-semibold text-ink-soft">{label}</span>
              {!trailing && <span className="shrink-0 text-[13px] text-ink-faint">No file yet</span>}
            </span>
          )}
          {trailing}
        </div>
        {below}
      </div>
    );
  }

  const total = duration || 0;
  const pct = total ? current / total : 0;
  const status = !playing ? 'Paused' : mine ? 'Your part · Playing' : 'Playing';

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-[18px] border-[1.5px] border-accent bg-surface p-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-accent-fg shadow-pop transition active:scale-[0.95]"
            aria-label={playing ? `Pause ${label}` : `Play ${label}`}
          >
            {playing ? <Pause width={18} height={18} /> : <Play width={18} height={18} className="ml-0.5" />}
          </button>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-bold leading-[22px] text-ink">{label}</span>
            <span className="block text-[13px] font-bold leading-[18px] text-accent-ink">{status}</span>
          </span>
          <button type="button" onClick={restart} className="btn-icon" aria-label="Restart">
            <RotateCcw width={20} height={20} />
          </button>
          <button
            type="button"
            onClick={toggleLoop}
            aria-pressed={loop}
            className={cn('btn-icon', loop && 'bg-accent-soft text-accent-ink')}
            aria-label="Loop"
          >
            <Repeat width={20} height={20} />
          </button>
          {trailing}
        </div>

        <div>
          <div className="relative h-[30px]">
            <div className="pointer-events-none absolute inset-0 flex items-center gap-[2px]" aria-hidden>
              {bars.map((b, i) => (
                <span
                  key={i}
                  className={cn('flex-1 rounded-[2px]', (i + 0.5) / BARS <= pct ? 'bg-accent' : 'bg-track')}
                  style={{ height: `${Math.round(b * 100)}%` }}
                />
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={total}
              step={0.1}
              value={Math.min(current, total)}
              onChange={(e) => seek(Number(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Seek"
            />
          </div>
          <div className="mt-1 flex justify-between text-xs font-semibold tabular-nums text-ink-faint">
            <span>{clock(current)}</span>
            <span>{clock(total)}</span>
          </div>
        </div>

        {failed && (
          <p role="alert" className="text-[13px] font-semibold text-bad-ink">
            This audio couldn’t be played in your browser.
          </p>
        )}
      </div>
      {below}
    </div>
  );
}
