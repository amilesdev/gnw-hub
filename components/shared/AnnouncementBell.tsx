'use client';

import { useEffect, useState } from 'react';
import type { AnnouncementDTO } from '@/lib/serialize';
import { Modal } from './Modal';
import { AnnouncementDetailModal } from './AnnouncementDetailModal';
import { AnnouncementForm } from '@/components/leader/AnnouncementForm';
import { ConfirmDialog } from './ConfirmDialog';
import { Bell, Plus, Pencil, Trash, ChevronRight } from './Icons';
import { apiFetch } from '@/lib/api-client';
import { formatExpiry, expiringSoon } from '@/lib/announcement-ui';

/**
 * Bell with a dot badge (shown when active announcements exist). Tapping opens
 * a modal listing active titles; tapping a title opens the full detail.
 * Leaders additionally get add/edit/delete with expiry shown.
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

  const hasActive = items.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setListOpen(true)}
        className="relative grid h-11 w-11 place-items-center rounded-2xl bg-surface border border-line text-ink-soft shadow-card"
        aria-label="Announcements"
      >
        <Bell width={21} height={21} />
        {hasActive && (
          <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-bad ring-2 ring-surface" />
        )}
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
            {items.map((a) => (
              <li key={a.id} className="rounded-2xl border border-line bg-surface p-3">
                <button type="button" className="row-press flex w-full items-center gap-2 text-left" onClick={() => setDetail(a)}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{a.title}</span>
                    {canManage && (
                      <span className={expiringSoon(a.expiresAt) ? 'text-xs font-semibold text-warn' : 'text-xs text-ink-faint'}>
                        Expires {formatExpiry(a.expiresAt)}
                      </span>
                    )}
                  </span>
                  <ChevronRight width={18} height={18} className="text-ink-faint" />
                </button>
                {canManage && (
                  <div className="mt-2 flex gap-2">
                    <button className="btn-ghost !py-1.5 text-xs" onClick={() => setEditing(a)} type="button">
                      <Pencil width={14} height={14} /> Edit
                    </button>
                    <button className="btn-ghost !py-1.5 text-xs text-bad" onClick={() => setConfirming(a)} type="button">
                      <Trash width={14} height={14} /> Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
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
