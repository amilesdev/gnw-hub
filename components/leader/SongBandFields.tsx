'use client';

import { useEffect, useState } from 'react';
import type { SongDTO } from '@/lib/setlist-serialize';
import { Check } from '@/components/shared/Icons';
import { AudioSlotRow, EditorGroup } from './AudioSlotRow';
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
  const [error, setError] = useState<string | null>(null);
  // "Saved" next to Key/BPM for 2s after a blur that actually saved (SG-C9).
  const [savedAt, setSavedAt] = useState(0);
  useEffect(() => {
    if (!savedAt) return;
    const t = window.setTimeout(() => setSavedAt(0), 2000);
    return () => window.clearTimeout(t);
  }, [savedAt]);

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
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  async function uploadArrangement(file: File, onProgress: (pct: number) => void) {
    setError(null);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      const path = `audio/library/${slug(song.songTitle)}-${song.id.slice(-6)}/arrangement.${ext}`;
      await patch({ arrangementAudio: await uploadFile(path, file, onProgress) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    }
  }

  async function clearArrangement() {
    setError(null);
    try {
      await patch({ arrangementAudio: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove.');
    }
  }

  return (
    <EditorGroup title="Key, BPM & arrangement">
      <div className="grid grid-cols-2 gap-2">
        <input
          className="field"
          value={songKey}
          onChange={(e) => setSongKey(e.target.value)}
          onBlur={(e) => saveText('songKey', e.target.value)}
          placeholder="Key (e.g. G)"
          aria-label="Key"
          enterKeyHint="done"
        />
        <input
          className="field"
          value={bpm}
          onChange={(e) => setBpm(e.target.value)}
          onBlur={(e) => saveText('bpm', e.target.value)}
          placeholder="BPM (e.g. 72)"
          aria-label="BPM"
          inputMode="numeric"
          enterKeyHint="done"
        />
      </div>
      {savedAt > 0 && (
        <p role="status" className="-mt-1 inline-flex items-center gap-1 text-xs font-semibold text-good-ink">
          <Check width={13} height={13} /> Saved
        </p>
      )}

      {/* Arrangement — one audio file, same upload/replace/clear as a vocal part. */}
      <AudioSlotRow
        label="Arrangement"
        url={song.arrangementAudio}
        songTitle={song.songTitle}
        onUpload={uploadArrangement}
        onClear={clearArrangement}
      />

      {error && <p role="alert" className="text-[13px] font-semibold text-bad-ink">{error}</p>}
    </EditorGroup>
  );
}
