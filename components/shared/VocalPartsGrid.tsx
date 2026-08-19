'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SongDTO } from '@/lib/setlist-serialize';
import { AUDIO_PARTS, PART_LABELS, PART_SLUG, type AudioPart } from '@/lib/setlist-serialize';
import { ConfirmDialog } from './ConfirmDialog';
import { Play, Upload, Trash } from './Icons';
import { apiFetch } from '@/lib/api-client';
import { uploadFile } from '@/lib/upload-client';
import { cn } from '@/lib/utils';

/**
 * The four vocal-part tiles inside the song card.
 *
 * Read-only for everyone (tap to play; an empty part reads "Soon") — except a
 * leader or the vocal director, who additionally gets an Add tile where a part
 * is missing and Replace/Remove under one that's filled. The editing affordances
 * are the ONLY difference; nobody's view of the song changes shape.
 *
 * Uploads go browser → Supabase via a signed URL (`uploadFile`), so a big .wav
 * doesn't hit Vercel's ~4.5 MB request-body cap; the PATCH that follows only
 * carries the resulting URL. Replacing or removing a part deletes the previous
 * file server-side.
 */
export function VocalPartsGrid({
  song,
  canEdit,
  activePart,
  onSelect,
  onChanged,
}: {
  song: SongDTO;
  canEdit: boolean;
  activePart: AudioPart | null;
  onSelect: (part: AudioPart) => void;
  onChanged: (song: SongDTO) => void;
}) {
  const router = useRouter();
  const [busyPart, setBusyPart] = useState<AudioPart | null>(null);
  const [confirming, setConfirming] = useState<AudioPart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /** PATCH one audio slot (a URL to set it, null to clear it). */
  async function save(part: AudioPart, url: string | null) {
    const { song: updated } = await apiFetch<{ song: SongDTO }>(`/api/songs/${song.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ [part]: url }),
    });
    onChanged({ ...song, ...updated });
    // The screens behind this sheet are server-rendered from a cached setlist
    // read; the PATCH revalidated that tag, so pull the fresh copy through.
    router.refresh();
  }

  async function upload(part: AudioPart, file: File) {
    setBusyPart(part);
    setError(null);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      // Keyed by the library song, not by month: a song lives in the library and
      // may sit on several setlists. The id suffix keeps two same-titled songs apart.
      const path = `audio/library/${slug(song.songTitle)}-${song.id.slice(-6)}/${PART_SLUG[part]}.${ext}`;
      await save(part, await uploadFile(path, file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Try again.');
    } finally {
      setBusyPart(null);
    }
  }

  async function remove(part: AudioPart) {
    setBusyPart(part);
    setError(null);
    try {
      await save(part, null);
      setConfirming(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that part.');
    } finally {
      setBusyPart(null);
    }
  }

  return (
    <div>
      <p className="label mb-2">Vocal parts</p>
      <div className="grid grid-cols-2 gap-2.5">
        {AUDIO_PARTS.map((p) => {
          const available = Boolean(song[p]);
          const active = activePart === p;
          const busy = busyPart === p;

          // Empty slot, editor: the whole tile is the file picker.
          if (!available && canEdit) {
            return (
              <button
                key={p}
                type="button"
                disabled={busy}
                onClick={() => fileRefs.current[p]?.click()}
                className="row-press flex items-center justify-between rounded-2xl border border-dashed border-line bg-surface-2 px-4 py-4 text-left font-semibold text-ink-soft disabled:opacity-60"
              >
                <span>{PART_LABELS[p]}</span>
                {busy ? (
                  <span className="text-[11px] font-bold uppercase tracking-wide">Adding…</span>
                ) : (
                  <Upload width={18} height={18} className="text-accent dark:text-accent-on" />
                )}
              </button>
            );
          }

          return (
            <div
              key={p}
              className={cn(
                'flex flex-col rounded-2xl border',
                active
                  ? 'border-accent bg-accent shadow-pop'
                  : available
                    ? 'border-line bg-surface'
                    : 'border-line bg-surface-2',
              )}
            >
              <button
                type="button"
                disabled={!available}
                onClick={() => onSelect(p)}
                className={cn(
                  'row-press flex flex-1 items-center justify-between rounded-2xl px-4 py-4 text-left font-semibold',
                  active ? 'text-white' : available ? 'text-ink' : 'text-ink-faint',
                )}
              >
                <span>{PART_LABELS[p]}</span>
                {available ? (
                  <Play width={18} height={18} className={active ? 'text-white' : 'text-accent dark:text-accent-on'} />
                ) : (
                  <span className="text-[11px] font-bold uppercase tracking-wide">Soon</span>
                )}
              </button>

              {/* Editor controls sit under the play row so the tile still reads
                  as "tap to listen" first. */}
              {canEdit && available && (
                <div
                  className={cn(
                    'flex items-center gap-1 border-t px-2 py-1.5',
                    active ? 'border-white/25' : 'border-line',
                  )}
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRefs.current[p]?.click()}
                    className={cn(
                      'row-press flex-1 rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-50',
                      active ? 'text-white' : 'text-ink-soft',
                    )}
                  >
                    {busy ? 'Working…' : 'Replace'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirming(p)}
                    aria-label={`Remove ${PART_LABELS[p]}`}
                    className={cn(
                      'row-press rounded-lg p-1.5 disabled:opacity-50',
                      active ? 'text-white' : 'text-bad',
                    )}
                  >
                    <Trash width={15} height={15} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* One hidden picker per part, kept out of the grid so they can never
          affect its layout. */}
      {canEdit &&
        AUDIO_PARTS.map((p) => (
          <PartFileInput key={p} part={p} fileRefs={fileRefs} onPick={(f) => upload(p, f)} />
        ))}

      {error && <p className="mt-2 text-xs font-semibold text-bad">{error}</p>}

      <ConfirmDialog
        open={confirming !== null}
        title="Remove part?"
        message={
          confirming
            ? `This deletes the ${PART_LABELS[confirming]} audio for “${song.songTitle}” for everyone. You can upload a new one after.`
            : ''
        }
        confirmLabel="Remove"
        busy={busyPart !== null}
        onConfirm={() => confirming && remove(confirming)}
        onClose={() => setConfirming(null)}
      />
    </div>
  );
}

/**
 * The hidden file input for one part. Extensions are listed alongside `audio/*`
 * because iOS Safari greys out files it can't MIME-classify as audio — the
 * extension list is what actually makes .m4a/.wav pickable on a phone.
 */
function PartFileInput({
  part,
  fileRefs,
  onPick,
}: {
  part: AudioPart;
  fileRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  onPick: (file: File) => void;
}) {
  return (
    <input
      ref={(el) => {
        fileRefs.current[part] = el;
      }}
      type="file"
      accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.webm,.flac,.mp4"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onPick(f);
        e.target.value = ''; // let the same file be picked again after an error
      }}
    />
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'song';
}
