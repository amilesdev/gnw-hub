'use client';

import { Modal } from './Modal';
import { haptics } from '@/lib/haptics';

/** A sheet you must answer (CMP-6): no close button, Cancel + Confirm side by side. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busyLabel = 'Working…',
  destructive = true,
  onConfirm,
  onClose,
  busy,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busyLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  function confirm() {
    if (destructive) haptics.warn();
    onConfirm();
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title} hideClose>
      <p className="text-base leading-6 text-ink-soft">{message}</p>
      <div className="mt-5 flex gap-3">
        <button type="button" className="btn-ghost flex-1" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className={destructive ? 'btn-danger flex-1' : 'btn-primary flex-1'}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
