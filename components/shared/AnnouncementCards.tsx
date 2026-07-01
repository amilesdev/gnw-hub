'use client';

import { useState } from 'react';
import type { AnnouncementDTO } from '@/lib/serialize';
import { AnnouncementDetailModal } from './AnnouncementDetailModal';
import { Pin } from './Icons';
import { formatRelative } from '@/lib/announcement-ui';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/**
 * Tappable announcement cards for the home screen. Pinned posts sort first and
 * get a warm highlighted treatment. Each shows its author (avatar + name) and
 * how long ago it was posted. Leaders (`canManage`) get an inline pin toggle.
 */
export function AnnouncementCards({
  announcements,
  canManage = false,
  onChange,
}: {
  announcements: AnnouncementDTO[];
  canManage?: boolean;
  onChange?: () => void;
}) {
  const [detail, setDetail] = useState<AnnouncementDTO | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  if (announcements.length === 0) return null;

  async function togglePin(a: AnnouncementDTO) {
    setPinningId(a.id);
    try {
      await apiFetch(`/api/announcements/${a.id}/pin`, {
        method: 'POST',
        body: JSON.stringify({ pinned: !a.pinned }),
      });
      onChange?.();
    } finally {
      setPinningId(null);
    }
  }

  return (
    <div className="space-y-2.5">
      {announcements.map((a) => {
        const author = a.authorName ?? 'GNW Hub';
        const initial = author.slice(0, 1).toUpperCase();
        return (
          <div
            key={a.id}
            className={cn(
              'card relative flex w-full animate-rise items-start gap-3 p-4',
              a.pinned && 'border-warn/40 bg-gradient-to-br from-warn/[0.07] to-transparent',
            )}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-ink font-semibold text-white">
              {initial}
            </span>

            <button
              type="button"
              onClick={() => setDetail(a)}
              className="row-press min-w-0 flex-1 text-left"
            >
              <span className="flex items-center gap-1.5 text-xs text-ink-faint">
                <span className="truncate font-semibold text-ink-soft">{author}</span>
                <span aria-hidden>·</span>
                <span className="shrink-0">{formatRelative(a.createdAt)}</span>
              </span>
              <span className="mt-0.5 block truncate font-display font-semibold">{a.title}</span>
              {a.body && <span className="mt-1 line-clamp-2 block text-sm text-ink-soft">{a.body}</span>}
            </button>

            {canManage ? (
              <button
                type="button"
                onClick={() => togglePin(a)}
                disabled={pinningId === a.id}
                aria-pressed={a.pinned}
                aria-label={a.pinned ? 'Unpin announcement' : 'Pin announcement'}
                className={cn(
                  'row-press grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors disabled:opacity-50',
                  a.pinned ? 'border-warn/40 bg-warn/15 text-warn' : 'border-line bg-surface text-ink-faint',
                )}
              >
                <Pin width={16} height={16} />
              </button>
            ) : (
              a.pinned && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-warn">
                  <Pin width={13} height={13} /> Pinned
                </span>
              )
            )}
          </div>
        );
      })}
      {detail && <AnnouncementDetailModal announcement={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
