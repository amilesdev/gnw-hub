'use client';

import { useState } from 'react';
import type { SongDTO } from '@/lib/setlist-serialize';
import { AUDIO_PARTS, PART_LABELS, PART_SLUG, type AudioPart } from '@/lib/setlist-serialize';
import { AudioSlotRow, EditorGroup } from './AudioSlotRow';
import { apiFetch } from '@/lib/api-client';
import { uploadFile } from '@/lib/upload-client';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'song';
}

/** The four vocal-part audio slots in the leader editors (SG-C8). */
export function SongAudioSlots({
  song,
  month,
  onChanged,
}: {
  song: SongDTO;
  month: string;
  onChanged: (song: SongDTO) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function patch(part: AudioPart, url: string | null) {
    const { song: updated } = await apiFetch<{ song: SongDTO }>(`/api/songs/${song.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ [part]: url }),
    });
    onChanged({ ...song, ...updated });
  }

  async function upload(part: AudioPart, file: File, onProgress: (pct: number) => void) {
    setError(null);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      // Suffix with the song id so two songs sharing a title don't collide.
      const path = `audio/${month}/${slug(song.songTitle)}-${song.id.slice(-6)}/${PART_SLUG[part]}.${ext}`;
      await patch(part, await uploadFile(path, file, onProgress));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    }
  }

  async function clearOne(part: AudioPart) {
    setError(null);
    try {
      await patch(part, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clear.');
    }
  }

  return (
    <EditorGroup title="Audio slots">
      {AUDIO_PARTS.map((part) => (
        <AudioSlotRow
          key={part}
          label={PART_LABELS[part]}
          url={song[part]}
          songTitle={song.songTitle}
          onUpload={(file, onProgress) => upload(part, file, onProgress)}
          onClear={() => clearOne(part)}
        />
      ))}
      {error && <p role="alert" className="text-[13px] font-semibold text-bad-ink">{error}</p>}
    </EditorGroup>
  );
}
