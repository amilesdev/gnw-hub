'use client';

import { useEffect, useState } from 'react';
import type { AnnouncementDTO } from '@/lib/serialize';
import { Modal } from './Modal';
import { AnnouncementDetailModal } from './AnnouncementDetailModal';
import { AnnouncementForm } from '@/components/leader/AnnouncementForm';
import { ConfirmDialog } from './ConfirmDialog';
import { Bell, Plus, Pencil, Trash, ChevronRight } from './Icons';
import { apiFetch } from '@/lib/api-client';
import { formatExpiry, expiringSoon, formatPosted } from '@/lib/announcement-ui';
import { cn } from '@/lib/utils';

// "Unread on this device" (HM-C4): the dot shows only for an announcement
// posted after this device last opened the bell. Per-device by design for now;
// cross-device unread would need a backend.
const SEEN_KEY = 'gnw-announcements-seen';

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Glass bell with an unread dot. Tapping opens a sheet listing active
 * announcements; tapping one opens the full detail. Leaders additionally get
 * add/edit/delete with expiry shown.
 */
export function AnnouncementBell({
  initial = [],
  canManage = false,
  onChange,
}: {
  initial?: AnnouncementDTO[];
  canManage?: boolean;
  onChange?: () => void;
}) {
  const [items, setItems] = useState<AnnouncementDTO[]>(initial);
  const [listOpen, setListOpen] = useState(false);
  const [detail, setDetail] = useState<AnnouncementDTO | null>(null);
  const [editing, setEditing] = useState<AnnouncementDTO | 'new' | null>(null);
  const [confirming, setConfirming] = useState<AnnouncementDTO | null>(null);
  const [busy, setBusy] = useState(false);
  // null until mounted, so the server render never guesses at localStorage.
  const [seenAt, setSeenAt] = useState<number | null>(null);

  useEffect(() => setSeenAt(readSeen()), []);

  async function refresh() {
    const { announcements } = await apiFetch<{ announcements: AnnouncementDTO[] }>('/api/announcements');
    setItems(announcements);
    onChange?.();
  }

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  async function remove() {
    if (!confirming) return;
    setBusy(true);
    try {
      await apiFetch(`/api/announcements/${confirming.id}`, { method: 'DELETE' });
      setConfirming(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function open() {
    setListOpen(true);
    const now = Date.now();
    setSeenAt(now);
    try {
      localStorage.setItem(SEEN_KEY, String(now));
    } catch {
      /* storage unavailable: the dot just comes back next visit */
    }
  }

  const unread = seenAt !== null && items.some((a) => new Date(a.createdAt).getTime() > seenAt);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="glass relative grid h-11 w-11 place-items-center rounded-full text-ink-soft transition-transform duration-150 ease-soft active:scale-[0.97]"
        aria-label={unread ? 'Announcements, new' : 'Announcements'}
      >
        <Bell width={20} height={20} />
        {unread && <span className="absolute right-2.5 top-[9px] h-[9px] w-[9px] rounded-full bg-unread ring-2 ring-surface" />}
      </button>

      <Modal open={listOpen} onClose={() => setListOpen(false)} title="Announcements">
        {canManage && (
          <button type="button" className="btn-primary mb-4 w-full" onClick={() => setEditing('new')}>
            <Plus width={18} height={18} /> Add announcement
          </button>
        )}
        {items.length === 0 ? (
          <p className="py-4 text-center text-ink-faint">No active announcements right now.</p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((a) =>
              canManage ? (
                <li key={a.id} className="rounded-2xl bg-surface-2 p-3.5">
                  <button type="button" className="row-press -m-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-xl p-1 text-left" onClick={() => setDetail(a)}>
                    <span className="min-w-0 flex-1">
                      <span className="row-title block truncate">{a.title}</span>
                      <span
                        className={cn(
                          'text-[13px] leading-[18px]',
                          expiringSoon(a.expiresAt) ? 'font-semibold text-warn-ink' : 'text-ink-faint',
                        )}
                      >
                        Expires {formatExpiry(a.expiresAt)}
                      </span>
                    </span>
                    <ChevronRight width={18} height={18} className="text-ink-faint" />
                  </button>
                  <div className="mt-2.5 flex gap-2">
                    <button className="btn-outline btn-sm" onClick={() => setEditing(a)} type="button">
                      <Pencil width={16} height={16} /> Edit
                    </button>
                    <button className="btn-danger-text btn-sm" onClick={() => setConfirming(a)} type="button">
                      <Trash width={16} height={16} /> Delete
                    </button>
                  </div>
                </li>
              ) : (
                <li key={a.id} className="rounded-2xl bg-surface-2 p-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="row-title min-w-0 flex-1 text-ink">{a.title}</p>
                    {a.authorName && <p className="shrink-0 text-[13px] font-semibold text-ink-soft">{a.authorName}</p>}
                  </div>
                  {a.body.trim() && (
                    <p className="selectable mt-2 whitespace-pre-wrap text-sm text-ink-soft">{a.body}</p>
                  )}
                  <p className="mt-3 text-right text-[13px] text-ink-faint">{formatPosted(a.createdAt)}</p>
                </li>
              ),
            )}
          </ul>
        )}
      </Modal>

      {detail && <AnnouncementDetailModal announcement={detail} onClose={() => setDetail(null)} />}

      {editing === 'new' && (
        <AnnouncementForm onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
      {editing && editing !== 'new' && (
        <AnnouncementForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}

      <ConfirmDialog
        open={!!confirming}
        title="Delete announcement?"
        message="This removes it from everyone's feed immediately."
        busy={busy}
        onConfirm={remove}
        onClose={() => setConfirming(null)}
      />
    </>
  );
}
