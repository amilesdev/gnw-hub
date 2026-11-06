'use client';

import { useAudio } from './AudioProvider';
import { useSongSheet } from './SongSheetHost';
import { Play, Pause, X } from './Icons';

const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * Persistent transport (SG-C3): a glass bar in the dock, above the tab bar,
 * whenever a part is playing, so a member can keep a track running while they
 * browse. Full-screen overlays (z-50 portals) cover it, so it never fights the
 * song sheet — it re-appears the moment the sheet closes. Tapping the middle
 * reopens the song (when the track carries a way to open it).
 */
export function MiniPlayer() {
  const { track, playing, current, duration, failed, toggle, stop } = useAudio();
  const sheet = useSongSheet();
  if (!track) return null;
  const reopen = track.song && sheet ? () => sheet.open(track.song!, track.context) : null;
  const pct = duration ? Math.min(100, (current / duration) * 100) : 0;

  const middle = (
    <>
      <span className="flex min-w-0 items-baseline text-[15px] leading-5">
        <span className="truncate font-semibold text-ink">{track.title}</span>
        <span className="shrink-0 whitespace-pre font-medium text-ink-soft">
          {` · ${track.part} · `}
          <span className="tabular-nums">{clock(current)}</span>
        </span>
      </span>
      {failed ? (
        <span className="mt-1.5 block text-[13px] font-semibold leading-[18px] text-bad-ink">Couldn’t play this audio.</span>
      ) : (
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-track" aria-hidden>
          <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </span>
      )}
    </>
  );

  return (
    <div className="no-print pointer-events-auto mx-3.5">
      <div className="glass flex items-center gap-3 rounded-[30px] py-[7px] pl-[7px] pr-1">
        <button
          type="button"
          onClick={toggle}
          className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-accent text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.55)] transition active:scale-[0.95]"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause width={16} height={16} /> : <Play width={16} height={16} className="ml-0.5" />}
        </button>

        {reopen ? (
          <button type="button" onClick={reopen} className="min-w-0 flex-1 text-left" aria-label={`Open ${track.title}`}>
            {middle}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{middle}</div>
        )}

        <button type="button" onClick={stop} className="btn-icon" aria-label="Stop playback">
          <X width={20} height={20} />
        </button>
      </div>
    </div>
  );
}
