'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LibrarySongDTO } from '@/lib/setlist-serialize';
import { AUDIO_PARTS } from '@/lib/setlist-serialize';
import { Overlay } from '@/components/shared/Overlay';
import { Check, Music, FileText } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/** Pick one or more existing library songs to drop into a setlist. */
export function LibraryPicker({
  excludeIds,
  onAdd,
  onClose,
}: {
  excludeIds: Set<string>;
  onAdd: (songs: LibrarySongDTO[]) => void;
  onClose: () => void;
}) {
  const [songs, setSongs] = useState<LibrarySongDTO[] | null>(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch<{ songs: LibrarySongDTO[] }>('/api/songs')
      .then(({ songs }) => setSongs(songs))
      .catch(() => setSongs([]));
  }, []);

  const available = useMemo(() => {
    const list = (songs ?? []).filter((s) => !excludeIds.has(s.id));
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (s) => s.songTitle.toLowerCase().includes(needle) || (s.artist ?? '').toLowerCase().includes(needle),
    );
  }, [songs, excludeIds, q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    const chosen = (songs ?? []).filter((s) => selected.has(s.id));
    if (chosen.length) onAdd(chosen);
  }

  return (
    <Overlay
      title="Add from library"
      onClose={onClose}
      action={
        <button type="button" className="btn-primary !px-4 !py-2.5" disabled={selected.size === 0} onClick={confirm}>
          Add{selected.size ? ` ${selected.size}` : ''}
        </button>
      }
    >
      <div className="space-y-4">
        <input
          className="field"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search songs or artists…"
          enterKeyHint="search"
          autoFocus
        />

        {songs === null ? (
          <p className="py-6 text-center text-sm text-ink-faint">Loading library…</p>
        ) : available.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-faint">
            {songs.length === 0
              ? 'Your library is empty. Add songs from the Song Library screen.'
              : (songs.length - excludeIds.size) <= 0
                ? 'Every library song is already in this setlist.'
                : 'No songs match that search.'}
          </p>
        ) : (
          <div className="card overflow-hidden">
            {available.map((s) => {
              const on = selected.has(s.id);
              const partCount = AUDIO_PARTS.filter((p) => s[p]).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-pressed={on}
                  className="row-press flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left last:border-0"
                >
                  <span
                    className={cn(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-md',
                      on ? 'bg-accent text-white' : 'border border-line',
                    )}
                  >
                    {on && <Check width={14} height={14} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.songTitle}</span>
                    <span className="flex items-center gap-2 text-xs text-ink-faint">
                      {s.artist && <span className="truncate">{s.artist}</span>}
                      <span className="inline-flex items-center gap-1">
                        <Music width={12} height={12} />
                        {partCount}
                      </span>
                      {s.lyricChart && (
                        <span className="inline-flex items-center gap-1">
                          <FileText width={12} height={12} /> Chart
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Overlay>
  );
}
