'use client';

import type { SongDTO } from '@/lib/setlist-serialize';
import type { SongSheetContext } from './AudioProvider';
import { PartRow } from './PartRow';
import { InlineEmpty } from './EmptyState';
import { FileText } from './Icons';

/**
 * Band view of a song (SG-C6): the single arrangement audio file, played in
 * the same part row as the vocal parts (pause, restart, loop, seek), and a
 * Chart slot. Read-only — arrangement, key, and BPM are edited by leaders from
 * the Edit Setlist / Library editors, and key/BPM show in the sheet's tiles.
 * `canEdit` only tunes the Chart placeholder's wording. Chart is intentionally
 * inert until an upload system is chosen.
 */
export function BandSongSection({
  song,
  canEdit,
  context,
}: {
  song: SongDTO;
  canEdit: boolean;
  context?: SongSheetContext;
}) {
  return (
    <div className="space-y-6">
      <section>
        <p className="eyebrow mb-3">Arrangement</p>
        {song.arrangementAudio ? (
          <PartRow
            id={`${song.id}:arrangement`}
            label="Arrangement"
            src={song.arrangementAudio}
            song={song}
            context={context}
          />
        ) : (
          <InlineEmpty>Arrangement will appear here once your leaders add it.</InlineEmpty>
        )}
      </section>

      {/* Chart — inert until an upload system is chosen. Kept backend-free on purpose. */}
      <section>
        <p className="eyebrow mb-3">Chart</p>
        <div
          aria-disabled
          className="flex min-h-14 items-center gap-3 rounded-[18px] border border-line bg-surface-2 p-2 pr-4 opacity-60"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-ink-soft">
            <FileText width={18} height={18} />
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold text-ink-soft">
            {canEdit ? 'Upload chart' : 'Number chart'}
          </span>
          <span className="micro shrink-0 text-ink-faint">Coming soon</span>
        </div>
      </section>
    </div>
  );
}
