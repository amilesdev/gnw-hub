'use client';

import { Modal } from './Modal';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  destructive = true,
  onConfirm,
  onClose,
  busy,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-ink-soft">{message}</p>
      <div className="mt-5 flex gap-3">
        <button type="button" className="btn-ghost flex-1" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={
            destructive
              ? 'inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-bad px-5 py-3.5 font-semibold text-white shadow-pop transition active:scale-[0.97] disabled:opacity-40'
              : 'btn-primary flex-1'
          }
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
