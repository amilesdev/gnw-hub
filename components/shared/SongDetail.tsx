'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import type { SongDTO } from '@/lib/setlist-serialize';
import { AUDIO_PARTS, PART_LABELS, type AudioPart } from '@/lib/setlist-serialize';
import { canSeeVocals, canSeeBandCharts } from '@/lib/access';
import { Overlay } from './Overlay';
import { AudioPlayer } from './AudioPlayer';
import { useAudio } from './AudioProvider';
import { LyricChartPreview } from './LyricChartPreview';
import { BandSongSection } from './BandSongSection';
import { Play, Music, FileText } from './Icons';
import { cn } from '@/lib/utils';

/**
 * Song view. Vocalists (and any leader) get the four vocal part buttons + an
 * in-app player + lyrics. Band-section members (and any leader) get the band
 * section instead/as well: arrangement, key, BPM, and a chart slot.
 */
export function SongDetail({ song, onClose }: { song: SongDTO; onClose: () => void }) {
  const [part, setPart] = useState<AudioPart | null>(null);
  const activeSrc = part ? song[part] : null;
  const { play } = useAudio();
  const { data: session } = useSession();
  const viewer = session?.user;
  // Default to showing vocals until the session resolves, so a vocalist never
  // flashes the band section; only a confirmed Band member hides the vocals.
  const showVocals = !viewer || canSeeVocals(viewer);
  const showBand = viewer ? canSeeBandCharts(viewer) : false;
  const canEditBand = viewer?.role === 'leader';

  return (
    <Overlay title={song.songTitle} onClose={onClose}>
      <div className="space-y-5">
        {(song.youtubeLink || song.driveLink) && (
          <div className="flex flex-wrap gap-2">
            {song.youtubeLink && (
              <a href={song.youtubeLink} target="_blank" rel="noreferrer" className="btn-ghost text-sm">
                ▶ YouTube
              </a>
            )}
            {song.driveLink && (
              <a href={song.driveLink} target="_blank" rel="noreferrer" className="btn-ghost text-sm">
                Drive parts
              </a>
            )}
          </div>
        )}

        {showVocals && (
        <div>
          <p className="label mb-2">Vocal parts</p>
          <div className="grid grid-cols-2 gap-2.5">
            {AUDIO_PARTS.map((p) => {
              const available = Boolean(song[p]);
              const active = part === p;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={!available}
                  onClick={() => {
                    setPart(p);
                    play({ src: song[p]!, title: song.songTitle, part: PART_LABELS[p] });
                  }}
                  className={cn(
                    'row-press flex items-center justify-between rounded-2xl border px-4 py-4 text-left font-semibold',
                    active
                      ? 'border-accent bg-accent text-white shadow-pop'
                      : available
                        ? 'border-line bg-surface text-ink'
                        : 'border-line bg-surface-2 text-ink-faint',
                  )}
                >
                  <span>{PART_LABELS[p]}</span>
                  {available ? (
                    <Play width={18} height={18} className={active ? 'text-white' : 'text-accent dark:text-accent-on'} />
                  ) : (
                    <span className="text-[11px] font-bold uppercase tracking-wide">Soon</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
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

        {showVocals && song.lyricChart && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FileText width={16} height={16} className="text-ink-soft" />
              <p className="label !mb-0">Lyrics</p>
            </div>
            <div className="card p-4">
              <LyricChartPreview chart={song.lyricChart} bare />
            </div>
            <p className="mt-2 text-center text-[11px] text-ink-faint">Imported from Google Docs</p>
          </div>
        )}

        {/* Band section: arrangement, key, BPM, chart. Shown to band members and
            any leader; leaders can edit inline. */}
        {showBand && <BandSongSection song={song} canEdit={canEditBand} />}
      </div>
    </Overlay>
  );
}
