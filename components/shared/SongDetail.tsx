'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { SongDTO } from '@/lib/setlist-serialize';
import { PART_LABELS, type AudioPart } from '@/lib/setlist-serialize';
import { canSeeVocals, canSeeBandCharts, editsVocalPartsInSongCard, canEditLyricCharts } from '@/lib/access';
import { Overlay } from './Overlay';
import { AudioPlayer } from './AudioPlayer';
import { useAudio } from './AudioProvider';
import { LyricChartPreview } from './LyricChartPreview';
import { LyricChartImport } from './LyricChartImport';
import { BandSongSection } from './BandSongSection';
import { VocalPartsGrid } from './VocalPartsGrid';
import { SongLeadBlock } from './SongLeads';
import { Music, FileText } from './Icons';

/**
 * Song view. Vocalists (and any leader) get the four vocal part buttons + an
 * in-app player + lyrics. Band-section members (and any leader) get the band
 * section instead/as well: arrangement, key, BPM, and a chart slot.
 *
 * The vocal director and the administrative assistant can also edit from right
 * here — the vocal parts grid and the lyric chart importer are the only editable
 * things in this sheet, and each appears only for whoever holds that capability.
 * Everyone else's view — leaders included, who edit from Edit Setlist — is a
 * reader's view.
 */
export function SongDetail({ song: initialSong, onClose }: { song: SongDTO; onClose: () => void }) {
  // Local copy so an edit to a part shows at once; the screen behind the sheet
  // catches up separately (VocalPartsGrid calls router.refresh()).
  const [song, setSong] = useState(initialSong);
  const [part, setPart] = useState<AudioPart | null>(null);
  const activeSrc = part ? song[part] : null;
  const router = useRouter();
  const { play } = useAudio();
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

  return (
    <Overlay title={song.songTitle} onClose={onClose}>
      <div className="space-y-5">
        {(song.youtubeLink || song.songKey || song.bpm) && (
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {song.youtubeLink && (
                <a href={song.youtubeLink} target="_blank" rel="noreferrer" className="btn-ghost text-sm">
                  ▶ YouTube
                </a>
              )}
            </div>

            {/* Key + BPM — read-only for everyone; edited by leaders in Edit Setlist. */}
            {(song.songKey || song.bpm) && (
              <div className="shrink-0 space-y-1.5 text-right">
                {song.songKey && (
                  <div className="flex items-baseline justify-end gap-2">
                    <span className="label !mb-0">Key</span>
                    <span className="font-display text-lg font-semibold leading-none text-ink">{song.songKey}</span>
                  </div>
                )}
                {song.bpm && (
                  <div className="flex items-baseline justify-end gap-2">
                    <span className="label !mb-0">BPM</span>
                    <span className="font-display text-lg font-semibold leading-none text-ink">{song.bpm}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sits under the YouTube/key row and above the parts — read first, then sing along. */}
        <SongLeadBlock leads={song.leads} />

        {showVocals && (
          <VocalPartsGrid
            song={song}
            canEdit={canEditParts}
            activePart={part}
            onSelect={(p) => {
              setPart(p);
              play({ src: song[p]!, title: song.songTitle, part: PART_LABELS[p] });
            }}
            onChanged={(updated) => {
              setSong(updated);
              // A part that just got removed can't stay loaded in the player row.
              setPart((cur) => (cur && !updated[cur] ? null : cur));
            }}
          />
        )}

        {showVocals &&
          (activeSrc ? (
            <AudioPlayer />
          ) : (
            <div className="card flex items-center gap-3 p-4 text-ink-faint">
              <Music width={20} height={20} />
              <span className="text-sm">Pick a part above to start listening.</span>
            </div>
          ))}

        {/* Lyrics. Read-only for vocalists; whoever holds the lyric-chart
            capability additionally gets the Google Doc importer above the
            chart, and sees the section even before one has been imported. */}
        {(canEditCharts || (showVocals && song.lyricChart)) && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FileText width={16} height={16} className="text-ink-soft" />
              <p className="label !mb-0">Lyrics</p>
            </div>

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
                <div className="card p-4">
                  <LyricChartPreview chart={song.lyricChart} bare />
                </div>
                <p className="mt-2 text-center text-[11px] text-ink-faint">Imported from Google Docs</p>
              </>
            )}
          </div>
        )}

        {/* Band section: arrangement, key, BPM, chart. Shown to band members and
            any leader; leaders can edit inline. */}
        {showBand && <BandSongSection song={song} canEdit={canEditBand} />}
      </div>
    </Overlay>
  );
}
