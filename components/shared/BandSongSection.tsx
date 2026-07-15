'use client';

import { useState } from 'react';
import type { SongDTO } from '@/lib/setlist-serialize';
import { useAudio } from './AudioProvider';
import { Play, FileText, Music } from './Icons';
import { cn } from '@/lib/utils';

/**
 * Band view of a song: the single arrangement audio file (played in-app, just
 * like a vocal part) and a Chart slot. Read-only — arrangement, key, and BPM are
 * edited by leaders from the Edit Setlist / Library editors, and key/BPM show in
 * the card header. `canEdit` only tunes the Chart placeholder's wording. Chart is
 * intentionally inert until an upload system is chosen.
 */
export function BandSongSection({ song, canEdit }: { song: SongDTO; canEdit: boolean }) {
  const { play } = useAudio();
  const [playing, setPlaying] = useState(false);

  return (
    <div className="space-y-5">
      {/* Arrangement — a single audio file, played like a vocal part. */}
      <div>
        <p className="label mb-2">Arrangement</p>
        {song.arrangementAudio ? (
          <button
            type="button"
            onClick={() => {
              setPlaying(true);
              play({ src: song.arrangementAudio!, title: song.songTitle, part: 'Arrangement' });
            }}
            className={cn(
              'row-press flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left font-semibold',
              playing ? 'border-accent bg-accent text-white shadow-pop' : 'border-line bg-surface text-ink',
            )}
          >
            <span>Play arrangement</span>
            <Play width={18} height={18} className={playing ? 'text-white' : 'text-accent dark:text-accent-on'} />
          </button>
        ) : (
          <div className="card flex items-center gap-3 p-4 text-ink-faint">
            <Music width={20} height={20} />
            <span className="text-sm">Arrangement will appear here once your leaders add it.</span>
          </div>
        )}
      </div>

      {/* Chart — styled like the lyrics section but inert until an upload system
          is chosen. Kept backend-free on purpose. */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <FileText width={16} height={16} className="text-ink-soft" />
          <p className="label !mb-0">Chart</p>
        </div>
        <button
          type="button"
          disabled
          className="flex w-full cursor-not-allowed items-center justify-between rounded-2xl border border-line bg-surface-2 px-4 py-4 text-left font-semibold text-ink-faint opacity-60"
        >
          <span>{canEdit ? 'Upload chart' : 'Number chart'}</span>
          <span className="text-[11px] font-bold uppercase tracking-wide">Coming soon</span>
        </button>
      </div>
    </div>
  );
}
