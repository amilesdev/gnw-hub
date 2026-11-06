'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LibrarySongDTO } from '@/lib/setlist-serialize';
import { AUDIO_PARTS } from '@/lib/setlist-serialize';
import { Overlay } from '@/components/shared/Overlay';
import { SearchField } from '@/components/shared/SearchField';
import { SetlistSkeleton } from '@/components/shared/Skeleton';
import { listCard } from '@/lib/ui-classes';
import { Check, Music, FileText } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/**
 * Pick one or more existing songs: library songs to drop into a setlist (or to
 * import into Crossover), or — scope "crossover" — Crossover-list songs for a set.
 */
export function LibraryPicker({
  excludeIds,
  onAdd,
  onClose,
  scope = 'library',
  title = 'Add from library',
  actionLabel = 'Add',
}: {
  excludeIds: Set<string>;
  onAdd: (songs: LibrarySongDTO[]) => void;
  onClose: () => void;
  scope?: LibrarySongDTO['scope'];
  title?: string;
  actionLabel?: string;
}) {
  const [songs, setSongs] = useState<LibrarySongDTO[] | null>(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch<{ songs: LibrarySongDTO[] }>(`/api/songs?scope=${scope}`)
      .then(({ songs }) => setSongs(songs))
      .catch(() => setSongs([]));
  }, [scope]);

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
      title={title}
      onClose={onClose}
      action={
        <button type="button" className="btn-primary btn-sm h-11" disabled={selected.size === 0} onClick={confirm}>
          {actionLabel}{selected.size ? ` ${selected.size}` : ''}
        </button>
      }
    >
      <div className="space-y-4">
        <SearchField value={q} onChange={setQ} placeholder="Search songs or artists…" />

        {songs === null ? (
          <div role="status" aria-label="Loading">
            <SetlistSkeleton rows={6} />
          </div>
        ) : available.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-faint">
            {songs.length === 0
              ? scope === 'crossover'
                ? 'No Crossover songs yet. Add them from Crossover → Sets → Songs.'
                : 'Your library is empty. Add songs from the Song Library screen.'
              : (songs.length - excludeIds.size) <= 0
                ? 'Every song is already in here.'
                : 'No songs match that search.'}
          </p>
        ) : (
          <div className={listCard}>
            {available.map((s) => {
              const on = selected.has(s.id);
              const partCount = AUDIO_PARTS.filter((p) => s[p]).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-pressed={on}
                  className="row-press flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left"
                >
                  <span
                    className={cn(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-md',
                      on ? 'bg-accent text-accent-fg' : 'border border-line',
                    )}
                  >
                    {on && <Check width={14} height={14} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="row-title block truncate">{s.songTitle}</span>
                    <span className="flex items-center gap-2 text-[13px] leading-[18px] text-ink-soft">
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
