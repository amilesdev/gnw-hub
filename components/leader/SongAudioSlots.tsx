'use client';

import { useRef, useState } from 'react';
import type { SongDTO } from '@/lib/setlist-serialize';
import { AUDIO_PARTS, PART_LABELS, PART_SLUG, type AudioPart } from '@/lib/setlist-serialize';
import { Upload, Check, Trash } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { uploadFile } from '@/lib/upload-client';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'song';
}

export function SongAudioSlots({
  song,
  month,
  onChanged,
}: {
  song: SongDTO;
  month: string;
  onChanged: (song: SongDTO) => void;
}) {
  const [busyPart, setBusyPart] = useState<AudioPart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(part: AudioPart, file: File) {
    setBusyPart(part);
    setError(null);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      // Suffix with the song id so two songs sharing a title don't collide.
      const path = `audio/${month}/${slug(song.songTitle)}-${song.id.slice(-6)}/${PART_SLUG[part]}.${ext}`;
      const url = await uploadFile(path, file);
      const { song: updated } = await apiFetch<{ song: SongDTO }>(`/api/songs/${song.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [part]: url }),
      });
      onChanged({ ...song, ...updated });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusyPart(null);
    }
  }

  async function clearOne(part: AudioPart) {
    setBusyPart(part);
    try {
      const { song: updated } = await apiFetch<{ song: SongDTO }>(`/api/songs/${song.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [part]: null }),
      });
      onChanged({ ...song, ...updated });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clear.');
    } finally {
      setBusyPart(null);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl bg-surface-2/50 p-3">
      <p className="label">Audio slots</p>
      {AUDIO_PARTS.map((part) => {
        const url = song[part];
        const busy = busyPart === part;
        return (
          <div key={part} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
            <span className="w-20 shrink-0 text-sm font-semibold">{PART_LABELS[part]}</span>
            {url ? (
              <>
                <span className="inline-flex min-w-0 flex-1 items-center gap-1 text-xs text-good">
                  <Check width={14} height={14} className="shrink-0" />
                  <span className="truncate">{decodeURIComponent(url.split('/').pop() ?? 'uploaded')}</span>
                </span>
                <button type="button" className="btn-ghost !px-2.5 !py-1.5 text-xs" disabled={busy} onClick={() => fileRefs.current[part]?.click()}>
                  Replace
                </button>
                <button
                  type="button"
                  className="row-press rounded-lg p-1 text-bad"
                  disabled={busy}
                  onClick={() => clearOne(part)}
                  aria-label="Delete audio"
                >
                  <Trash width={16} height={16} />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-ghost ml-auto !px-3 !py-1.5 text-xs"
                disabled={busy}
                onClick={() => fileRefs.current[part]?.click()}
              >
                <Upload width={14} height={14} /> {busy ? 'Uploading…' : 'Upload'}
              </button>
            )}
            <input
              ref={(el) => {
                fileRefs.current[part] = el;
              }}
              type="file"
              // Explicit extensions alongside `audio/*` — iOS Safari greys out
              // files it can't MIME-classify as audio, so extension matching is
              // what actually lets you pick .m4a/.wav/.flac/etc. on a phone.
              accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.webm,.flac,.mp4"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(part, f);
                e.target.value = '';
              }}
            />
          </div>
        );
      })}
      {error && <p className="text-xs font-semibold text-bad">{error}</p>}
    </div>
  );
}
