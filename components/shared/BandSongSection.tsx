'use client';

import { useRef, useState } from 'react';
import type { SongDTO } from '@/lib/setlist-serialize';
import { useAudio } from './AudioProvider';
import { Play, Upload, Check, Trash, FileText, Music } from './Icons';
import { apiFetch } from '@/lib/api-client';
import { uploadFile } from '@/lib/upload-client';
import { cn } from '@/lib/utils';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'song';
}

/**
 * Band view of a song: the single arrangement audio file (behaves exactly like a
 * vocal part — uploaded to storage, played in-app), key + BPM, and a Chart slot.
 * Leaders (`canEdit`) get inline upload + editable key/BPM; band members without
 * the leader role see it read-only. Chart is intentionally inert for now.
 */
export function BandSongSection({ song, canEdit }: { song: SongDTO; canEdit: boolean }) {
  const { play } = useAudio();
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Local copies so a leader's inline edits show immediately without a refetch.
  const [arrangement, setArrangement] = useState(song.arrangementAudio);
  const [songKey, setSongKey] = useState(song.songKey ?? '');
  const [bpm, setBpm] = useState(song.bpm ?? '');
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, string | null>) {
    const { song: updated } = await apiFetch<{ song: SongDTO }>(`/api/songs/${song.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return updated;
  }

  async function uploadArrangement(file: File) {
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      const path = `audio/library/${slug(song.songTitle)}-${song.id.slice(-6)}/arrangement.${ext}`;
      const url = await uploadFile(path, file);
      const updated = await patch({ arrangementAudio: url });
      setArrangement(updated.arrangementAudio);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function clearArrangement() {
    setBusy(true);
    try {
      const updated = await patch({ arrangementAudio: null });
      setArrangement(updated.arrangementAudio);
      setPlaying(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove.');
    } finally {
      setBusy(false);
    }
  }

  // Persist key/BPM on blur, only when the value actually changed.
  async function saveField(field: 'songKey' | 'bpm', value: string) {
    const trimmed = value.trim();
    if (trimmed === ((field === 'songKey' ? song.songKey : song.bpm) ?? '')) return;
    try {
      await patch({ [field]: trimmed || null });
      song[field] = trimmed || null; // keep the baseline in sync for repeat edits
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  return (
    <div className="space-y-5">
      {/* Arrangement — a single audio file, played like a vocal part. */}
      <div>
        <p className="label mb-2">Arrangement</p>
        {arrangement ? (
          <button
            type="button"
            onClick={() => {
              setPlaying(true);
              play({ src: arrangement, title: song.songTitle, part: 'Arrangement' });
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
            <span className="text-sm">
              {canEdit ? 'No arrangement uploaded yet.' : 'Arrangement will appear here once your leaders add it.'}
            </span>
          </div>
        )}

        {canEdit && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost !px-3 !py-1.5 text-xs"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload width={14} height={14} /> {busy ? 'Uploading…' : arrangement ? 'Replace' : 'Upload'}
            </button>
            {arrangement && (
              <button
                type="button"
                className="row-press rounded-lg p-1.5 text-bad"
                disabled={busy}
                onClick={clearArrangement}
                aria-label="Remove arrangement"
              >
                <Trash width={16} height={16} />
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
        )}
      </div>

      {/* Key + BPM — editable text for leaders, plain read-out otherwise. */}
      {canEdit ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="label mb-1.5">Key</p>
            <input
              className="field"
              value={songKey}
              onChange={(e) => setSongKey(e.target.value)}
              onBlur={(e) => saveField('songKey', e.target.value)}
              placeholder="e.g. G"
              enterKeyHint="done"
            />
          </div>
          <div>
            <p className="label mb-1.5">BPM</p>
            <input
              className="field"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              onBlur={(e) => saveField('bpm', e.target.value)}
              placeholder="e.g. 72"
              inputMode="numeric"
              enterKeyHint="done"
            />
          </div>
        </div>
      ) : (
        (songKey || bpm) && (
          <div className="flex gap-6">
            {songKey && (
              <div>
                <p className="label mb-0.5">Key</p>
                <p className="font-display text-lg font-semibold">{songKey}</p>
              </div>
            )}
            {bpm && (
              <div>
                <p className="label mb-0.5">BPM</p>
                <p className="font-display text-lg font-semibold">{bpm}</p>
              </div>
            )}
          </div>
        )
      )}

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

      {error && <p className="text-xs font-semibold text-bad">{error}</p>}
    </div>
  );
}
