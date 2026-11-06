'use client';

import { useState } from 'react';
import type { AnnouncementDTO } from '@/lib/serialize';
import { AnnouncementDetailModal } from './AnnouncementDetailModal';
import { MemberAvatar } from './Avatar';
import { Pin } from './Icons';
import { formatRelative } from '@/lib/announcement-ui';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/**
 * Announcement cards for Home (HM-C4). Pinned posts sort first and get the warm
 * pinned fill. Each shows its author (avatar + name) and how long ago it was
 * posted. Leaders (`canManage`) get an inline pin toggle.
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
        // Only real (named) authors get their photo; the "GNW Hub" fallback keeps its initial.
        const authorImage = a.authorName ? a.authorImage : null;
        return (
          <div
            key={a.id}
            className={cn(
              'card relative flex w-full animate-rise items-start gap-3 p-4',
              a.pinned && 'border-warn/35 bg-pinned',
            )}
          >
            <MemberAvatar name={author} image={authorImage} size={40} />

            <button type="button" onClick={() => setDetail(a)} className="min-w-0 flex-1 text-left">
              <span className="flex items-center gap-1.5 pr-1 text-[13px] leading-[18px] text-ink-soft">
                <span className="truncate font-semibold">{author}</span>
                <span aria-hidden>·</span>
                <span className="shrink-0">{formatRelative(a.createdAt)}</span>
              </span>
              <span className="t-title-row mt-0.5 block truncate">{a.title}</span>
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
                  'btn-icon -my-1.5 -mr-1.5 disabled:opacity-50',
                  a.pinned ? 'bg-warn/15 text-warn-ink' : 'text-ink-faint',
                )}
              >
                <Pin width={18} height={18} />
              </button>
            ) : (
              a.pinned && <span className="micro shrink-0 text-warn-ink">Pinned</span>
            )}
          </div>
        );
      })}
      {detail && <AnnouncementDetailModal announcement={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
