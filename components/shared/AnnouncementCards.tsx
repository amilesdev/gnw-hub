'use client';

import { useState } from 'react';
import type { AnnouncementDTO } from '@/lib/serialize';
import { AnnouncementDetailModal } from './AnnouncementDetailModal';
import { ChevronRight } from './Icons';
import { formatPosted } from '@/lib/announcement-ui';

/** Tappable announcement title cards for the home screen, newest first. */
export function AnnouncementCards({ announcements }: { announcements: AnnouncementDTO[] }) {
  const [detail, setDetail] = useState<AnnouncementDTO | null>(null);
  if (announcements.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {announcements.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => setDetail(a)}
          className="card row-press flex w-full animate-rise items-center gap-3 p-4 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{a.title}</span>
            <span className="text-xs text-ink-faint">Posted {formatPosted(a.createdAt)}</span>
          </span>
          <ChevronRight width={20} height={20} className="text-ink-faint" />
        </button>
      ))}
      {detail && <AnnouncementDetailModal announcement={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
