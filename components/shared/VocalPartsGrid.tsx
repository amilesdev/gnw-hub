'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SongDTO } from '@/lib/setlist-serialize';
import { AUDIO_PARTS, PART_LABELS, PART_SLUG, type AudioPart } from '@/lib/setlist-serialize';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';
import { Play, Upload, Trash, Pencil } from './Icons';
import { apiFetch } from '@/lib/api-client';
import { uploadFile } from '@/lib/upload-client';
import { cn } from '@/lib/utils';

/**
 * The four vocal-part tiles inside the song card.
 *
 * Read-only for everyone (tap to play; an empty part reads "Soon") — except the
 * vocal director, whose only two additions are an Add tile wherever a part is
 * still missing, and an Edit button on the "Vocal parts" heading row once at
 * least one part exists. Replace/Remove live inside the dialog that button
 * opens, so a filled tile always reads exactly as it does for everyone else and
 * the grid never turns into a control panel.
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
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="label !mb-0">Vocal parts</p>
        {canEdit && filled.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing(true);
            }}
            className="row-press -my-1 -mr-1.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-accent dark:text-accent-on"
          >
            <Pencil width={13} height={13} />
            Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {AUDIO_PARTS.map((p) => {
          const available = Boolean(song[p]);
          const active = activePart === p;
          const busy = busyPart === p;

          // Empty slot, editor: the whole tile is the file picker. It stays put
          // once other parts are filled — the Edit dialog is for what's already
          // there; this is how the rest get added.
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

          // Everyone else's tile — and hers, once a part is filled: tap to play,
          // nothing more.
          return (
            <button
              key={p}
              type="button"
              disabled={!available}
              onClick={() => onSelect(p)}
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

      {/* One hidden picker per part, kept out of the grid so they can never
          affect its layout — and outside the dialog, so a Replace picked from
          there still lands if the dialog closes behind it. */}
      {canEdit &&
        AUDIO_PARTS.map((p) => (
          <PartFileInput key={p} part={p} fileRefs={fileRefs} onPick={(f) => upload(p, f)} />
        ))}

      {error && !editing && <p className="mt-2 text-xs font-semibold text-bad">{error}</p>}

      {/* Replace / remove, kept behind the Edit button so they never crowd the
          tiles. Only parts that exist are listed — an empty one is added from
          its own tile. */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit vocal parts">
        <div className="space-y-2">
          {filled.map((p) => {
            const busy = busyPart === p;
            return (
              <div key={p} className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{PART_LABELS[p]}</span>
                <button
                  type="button"
                  className="btn-ghost !bg-surface !px-3 !py-1.5 text-xs disabled:opacity-50"
                  disabled={busy}
                  onClick={() => fileRefs.current[p]?.click()}
                >
                  {busy ? 'Working…' : 'Replace'}
                </button>
                <button
                  type="button"
                  className="row-press rounded-xl p-1.5 text-bad disabled:opacity-50"
                  disabled={busy}
                  onClick={() => setConfirming(p)}
                  aria-label={`Remove ${PART_LABELS[p]}`}
                >
                  <Trash width={16} height={16} />
                </button>
              </div>
            );
          })}
        </div>

        {error && <p className="mt-3 text-xs font-semibold text-bad">{error}</p>}
        <p className="mt-3 text-xs text-ink-faint">
          Removing a part deletes it for everyone. Parts that aren’t listed here haven’t been uploaded
          yet — add those from the song card.
        </p>
      </Modal>

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
