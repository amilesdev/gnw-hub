'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { LeadDTO, SongDTO } from '@/lib/setlist-serialize';
import { canSeeVocals, canSeeBandCharts, editsVocalPartsInSongCard, canEditLyricCharts } from '@/lib/access';
import { Overlay } from './Overlay';
import { LinkPill } from './ScreenHeader';
import type { SongSheetContext } from './AudioProvider';
import { LyricChartPreview } from './LyricChartPreview';
import { LyricChartImport } from './LyricChartImport';
import { BandSongSection } from './BandSongSection';
import { VocalPartsGrid } from './VocalPartsGrid';

const VOCAL_PARTS = new Set(['Soprano', 'Alto', 'Tenor']);

/** "Aleena & Judy", or "Aleena +2" for three or more. */
function ledBy(leads: LeadDTO[]): string | null {
  if (leads.length === 0) return null;
  const first = leads.map((l) => l.name.trim().split(/\s+/)[0] || l.name);
  return first.length <= 2 ? first.join(' & ') : `${first[0]} +${first.length - 1}`;
}

function MetaTile({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface px-3 py-2.5 shadow-card">
      <p className="eyebrow">{label}</p>
      <p className="mt-0.5 truncate text-[17px] font-bold leading-[22px] text-ink">{value ?? '—'}</p>
    </div>
  );
}

/**
 * The song sheet (SG-3). Vocalists (and any leader) get the parts list with
 * its inline player and the lyrics; band-section members (and any leader) get
 * the arrangement and chart slot instead/as well. Key, BPM and who leads it
 * sit in tiles up top.
 *
 * The vocal director and the administrative assistant can also edit from right
 * here — the parts list and the lyric chart importer are the only editable
 * things in this sheet, and each appears only for whoever holds that capability.
 * Everyone else's view — leaders included, who edit from Edit Setlist — is a
 * reader's view.
 *
 * `context` says where it was opened from: the back pill's label ("Setlist",
 * "Library", "Event") and the eyebrow ("Sunday Service · Song 2 of 5").
 */
export function SongDetail({
  song: initialSong,
  onClose,
  context,
}: {
  song: SongDTO;
  onClose: () => void;
  context?: SongSheetContext;
}) {
  // Local copy so an edit to a part shows at once; the screen behind the sheet
  // catches up separately (VocalPartsGrid calls router.refresh()).
  const [song, setSong] = useState(initialSong);
  const router = useRouter();
  const { data: session } = useSession();
  const viewer = session?.user;
  // Default to showing vocals until the session resolves, so a vocalist never
  // flashes the band section; only a confirmed Band member hides the vocals.
  const showVocals = !viewer || canSeeVocals(viewer);
  const showBand = viewer ? canSeeBandCharts(viewer) : false;
  const canEditBand = viewer?.role === 'leader';
  // Vocal director only — a leader's card stays a reader's view; they edit parts
  // from Edit Setlist → Audio slots, as they always have.
  const canEditParts = viewer ? editsVocalPartsInSongCard(viewer) : false;
  const canEditCharts = viewer ? canEditLyricCharts(viewer) : false;
  const myPart = viewer?.part && VOCAL_PARTS.has(viewer.part) ? viewer.part : null;

  const fromLibrary = context?.fromLibrary ?? false;
  const lead = fromLibrary ? null : ledBy(song.leads);
  const showTiles = Boolean(song.songKey || song.bpm || lead);

  return (
    <Overlay
      title={song.songTitle}
      onClose={onClose}
      backLabel={context?.backLabel ?? (fromLibrary ? 'Library' : 'Back')}
      eyebrow={context?.eyebrow ?? (fromLibrary ? 'Library' : undefined)}
      action={song.youtubeLink ? <LinkPill href={song.youtubeLink}>YouTube</LinkPill> : undefined}
    >
      <div className="space-y-6">
        {song.artist && <p className="-mt-1.5 text-[15px] leading-[22px] text-ink-soft">{song.artist}</p>}

        {/* Key + BPM (+ who leads it, on a setlist) — read-only for everyone;
            edited by leaders in Edit Setlist / the Library editor. */}
        {showTiles && (
          <div className={fromLibrary ? 'grid grid-cols-2 gap-2.5' : 'grid grid-cols-[0.8fr_0.8fr_1.6fr] gap-2.5'}>
            <MetaTile label="Key" value={song.songKey} />
            <MetaTile label="BPM" value={song.bpm ? String(song.bpm) : null} />
            {!fromLibrary && <MetaTile label="Led by" value={lead} />}
          </div>
        )}

        {showVocals && (
          <VocalPartsGrid
            song={song}
            canEdit={canEditParts}
            myPart={myPart}
            context={context}
            onChanged={(updated) => setSong(updated)}
          />
        )}

        {/* Lyrics. Read-only for vocalists; whoever holds the lyric-chart
            capability additionally gets the Google Doc importer above the
            chart, and sees the section even before one has been imported. */}
        {(canEditCharts || (showVocals && song.lyricChart)) && (
          <section>
            <p className="eyebrow mb-3">Lyrics</p>

            {canEditCharts && (
              <div className="mb-3">
                {/* Heading above, chart below — the panel supplies only controls. */}
                <LyricChartImport
                  song={song}
                  embedded
                  onChanged={(updated) => {
                    setSong(updated);
                    // The screens behind this sheet are server-rendered from a
                    // cached setlist read; the PATCH revalidated that tag, so
                    // pull the fresh copy through.
                    router.refresh();
                  }}
                />
              </div>
            )}

            {song.lyricChart && (
              <>
                <div className="card p-5">
                  <LyricChartPreview chart={song.lyricChart} bare />
                </div>
                <p className="mt-2 text-center text-xs text-ink-faint">Imported from Google Docs</p>
              </>
            )}
          </section>
        )}

        {/* Band section: arrangement + chart. Shown to band members and any
            leader. */}
        {showBand && <BandSongSection song={song} canEdit={canEditBand} context={context} />}
      </div>
    </Overlay>
  );
}
