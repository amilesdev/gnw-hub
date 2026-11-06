'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SongDTO } from '@/lib/setlist-serialize';
import { AUDIO_PARTS, PART_LABELS, PART_SLUG, type AudioPart } from '@/lib/setlist-serialize';
import type { SongSheetContext } from './AudioProvider';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';
import { PartRow } from './PartRow';
import { Upload, Trash, Pencil } from './Icons';
import { apiFetch } from '@/lib/api-client';
import { uploadFile } from '@/lib/upload-client';

/**
 * The song sheet's parts list (SG-C1): Soprano, Alto, Tenor, All Parts, each a
 * row with the inline player. "You sing {Part}" sits on the heading when the
 * viewer has a vocal part.
 *
 * Read-only for everyone — except the vocal director, whose only additions are
 * an Upload button on each part still missing, and an Edit button on the
 * heading once at least one part exists. Replace/Remove live inside the dialog
 * that button opens, so a filled row always reads exactly as it does for
 * everyone else.
 *
 * Uploads go browser → Supabase via a signed URL (`uploadFile`), so a big .wav
 * doesn't hit Vercel's ~4.5 MB request-body cap; the PATCH that follows only
 * carries the resulting URL. Replacing or removing a part deletes the previous
 * file server-side.
 */
export function VocalPartsGrid({
  song,
  canEdit,
  myPart,
  context,
  onChanged,
}: {
  song: SongDTO;
  canEdit: boolean;
  /** The viewer's vocal part label ("Alto"), if they sing one. */
  myPart?: string | null;
  context?: SongSheetContext;
  onChanged: (song: SongDTO) => void;
}) {
  const router = useRouter();
  const [busyPart, setBusyPart] = useState<AudioPart | null>(null);
  const [progress, setProgress] = useState(0);
  const [confirming, setConfirming] = useState<AudioPart | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<{ part: AudioPart | null; message: string } | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const filled = AUDIO_PARTS.filter((p) => Boolean(song[p]));

  // Removing the last part leaves the dialog with nothing to edit — and takes
  // the Edit button away with it — so close rather than strand her in an empty
  // sheet.
  useEffect(() => {
    if (editing && filled.length === 0) setEditing(false);
  }, [editing, filled.length]);

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
    setProgress(0);
    setError(null);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      // Keyed by the library song, not by month: a song lives in the library and
      // may sit on several setlists. The id suffix keeps two same-titled songs apart.
      const path = `audio/library/${slug(song.songTitle)}-${song.id.slice(-6)}/${PART_SLUG[part]}.${ext}`;
      await save(part, await uploadFile(path, file, setProgress));
    } catch (e) {
      setError({ part, message: e instanceof Error ? e.message : 'Upload failed. Try again.' });
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
      setError({ part, message: e instanceof Error ? e.message : 'Could not remove that part.' });
    } finally {
      setBusyPart(null);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="eyebrow">Parts</p>
        <div className="flex items-center gap-3">
          {myPart && <p className="text-sm font-bold text-accent-ink">You sing {myPart}</p>}
          {canEdit && filled.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setEditing(true);
              }}
              className="btn-outline btn-sm"
            >
              <Pencil width={16} height={16} />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {AUDIO_PARTS.map((p) => {
          const busy = busyPart === p;
          const uploading = busy && !song[p];
          return (
            <PartRow
              key={p}
              id={`${song.id}:${p}`}
              label={PART_LABELS[p]}
              src={song[p]}
              song={song}
              context={context}
              mine={myPart === PART_LABELS[p]}
              trailing={
                canEdit && !song[p] ? (
                  uploading ? (
                    <span className="shrink-0 text-[13px] font-bold tabular-nums text-accent-ink">Uploading {progress}%</span>
                  ) : (
                    <button type="button" onClick={() => fileRefs.current[p]?.click()} className="btn-ghost btn-sm shrink-0">
                      <Upload width={16} height={16} /> Upload
                    </button>
                  )
                ) : undefined
              }
              below={
                <>
                  {busy && (
                    <div className="mx-4 mt-1 h-[3px] overflow-hidden rounded-full bg-track" aria-hidden>
                      <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  {error?.part === p && !editing && (
                    <p role="alert" className="mt-1.5 px-1 text-[13px] font-semibold text-bad-ink">{error.message}</p>
                  )}
                </>
              }
            />
          );
        })}
      </div>

      {/* One hidden picker per part, kept out of the list so they can never
          affect its layout — and outside the dialog, so a Replace picked from
          there still lands if the dialog closes behind it. */}
      {canEdit &&
        AUDIO_PARTS.map((p) => (
          <PartFileInput key={p} part={p} fileRefs={fileRefs} onPick={(f) => upload(p, f)} />
        ))}

      {/* Replace / remove, kept behind the Edit button so they never crowd the
          rows. Only parts that exist are listed — an empty one is added from
          its own row. */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit vocal parts">
        <div className="space-y-2">
          {filled.map((p) => {
            const busy = busyPart === p;
            return (
              <div key={p} className="flex items-center gap-2 rounded-2xl bg-surface-2 py-2 pl-4 pr-2">
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{PART_LABELS[p]}</span>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={busy}
                  onClick={() => fileRefs.current[p]?.click()}
                >
                  {busy ? `Uploading ${progress}%` : 'Replace'}
                </button>
                <button
                  type="button"
                  className="btn-icon text-bad-ink"
                  disabled={busy}
                  onClick={() => setConfirming(p)}
                  aria-label={`Remove ${PART_LABELS[p]}`}
                >
                  <Trash width={18} height={18} />
                </button>
              </div>
            );
          })}
        </div>

        {error && <p role="alert" className="mt-3 text-[13px] font-semibold text-bad-ink">{error.message}</p>}
        <p className="mt-3 text-[13px] leading-[18px] text-ink-faint">
          Removing a part deletes it for everyone. Parts that aren’t listed here haven’t been uploaded yet. Add those
          from the song sheet.
        </p>
      </Modal>

      <ConfirmDialog
        open={confirming !== null}
        title={confirming ? `Remove ${PART_LABELS[confirming]} audio?` : 'Remove audio?'}
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
    </section>
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
