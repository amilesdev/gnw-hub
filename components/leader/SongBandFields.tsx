'use client';

import { useRef, useState } from 'react';
import type { SongDTO } from '@/lib/setlist-serialize';
import { Upload, Check, Trash } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { uploadFile } from '@/lib/upload-client';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'song';
}

/**
 * Leader editor for a song's band content — musical key, BPM, and the single
 * arrangement audio file (which behaves exactly like a vocal part: uploaded to
 * storage, then played in-app from the song card). Key/BPM save on blur; the
 * arrangement uploads straight to storage then PATCHes its URL — the same
 * immediate-save model as the audio slots, so it slots into the Edit Setlist and
 * Library editors beside them. Values then show read-only in every song card.
 */
export function SongBandFields({
  song,
  onChanged,
}: {
  song: SongDTO;
  onChanged: (song: SongDTO) => void;
}) {
  const [songKey, setSongKey] = useState(song.songKey ?? '');
  const [bpm, setBpm] = useState(song.bpm ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function patch(body: Record<string, string | null>) {
    const { song: updated } = await apiFetch<{ song: SongDTO }>(`/api/songs/${song.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    onChanged(updated);
  }

  async function saveText(field: 'songKey' | 'bpm', value: string) {
    const trimmed = value.trim();
    if (trimmed === ((field === 'songKey' ? song.songKey : song.bpm) ?? '')) return;
    setError(null);
    try {
      await patch({ [field]: trimmed || null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  async function uploadArrangement(file: File) {
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      const path = `audio/library/${slug(song.songTitle)}-${song.id.slice(-6)}/arrangement.${ext}`;
      const url = await uploadFile(path, file);
      await patch({ arrangementAudio: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function clearArrangement() {
    setBusy(true);
    try {
      await patch({ arrangementAudio: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl bg-surface-2/50 p-3">
      <p className="label">Key, BPM &amp; arrangement</p>

      <div className="grid grid-cols-2 gap-2">
        <input
          className="field !py-2.5"
          value={songKey}
          onChange={(e) => setSongKey(e.target.value)}
          onBlur={(e) => saveText('songKey', e.target.value)}
          placeholder="Key (e.g. G)"
          enterKeyHint="done"
        />
        <input
          className="field !py-2.5"
          value={bpm}
          onChange={(e) => setBpm(e.target.value)}
          onBlur={(e) => saveText('bpm', e.target.value)}
          placeholder="BPM (e.g. 72)"
          inputMode="numeric"
          enterKeyHint="done"
        />
      </div>

      {/* Arrangement — one audio file, same upload/replace/clear as a vocal part. */}
      <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
        <span className="w-24 shrink-0 text-sm font-semibold">Arrangement</span>
        {song.arrangementAudio ? (
          <>
            <span className="inline-flex min-w-0 flex-1 items-center gap-1 text-xs text-good">
              <Check width={14} height={14} className="shrink-0" />
              <span className="truncate">{decodeURIComponent(song.arrangementAudio.split('/').pop() ?? 'uploaded')}</span>
            </span>
            <button type="button" className="btn-ghost !px-2.5 !py-1.5 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
              Replace
            </button>
            <button
              type="button"
              className="row-press rounded-lg p-1 text-bad"
              disabled={busy}
              onClick={clearArrangement}
              aria-label="Delete arrangement"
            >
              <Trash width={16} height={16} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn-ghost ml-auto !px-3 !py-1.5 text-xs"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload width={14} height={14} /> {busy ? 'Uploading…' : 'Upload'}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadArrangement(f);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="text-xs font-semibold text-bad">{error}</p>}
    </div>
  );
}
