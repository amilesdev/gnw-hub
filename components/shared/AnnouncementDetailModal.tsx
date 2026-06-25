'use client';

import type { AnnouncementDTO } from '@/lib/serialize';
import { Modal } from './Modal';
import { formatPosted } from '@/lib/announcement-ui';

export function AnnouncementDetailModal({ announcement, onClose }: { announcement: AnnouncementDTO; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={announcement.title}>
      <p className="eyebrow mb-3">Posted {formatPosted(announcement.createdAt)}</p>
      {announcement.body.trim() && <p className="whitespace-pre-wrap text-ink-soft">{announcement.body}</p>}
    </Modal>
  );
}
