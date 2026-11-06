'use client';

import type { ComponentType, ReactNode } from 'react';
import { Modal } from './Modal';
import { cn } from '@/lib/utils';

type IconProps = { width?: number; height?: number; className?: string };

export type ActionSheetAction = {
  label: string;
  onSelect: () => void;
  tone?: 'default' | 'danger' | 'danger-soft';
  icon?: ComponentType<IconProps>;
  disabled?: boolean;
};

/**
 * Leader "More" menu (CMP-23): a sheet titled with the item's name, a subline,
 * then full-width stacked actions and Cancel. Picking an action closes the
 * sheet first, so a follow-up ConfirmDialog doesn't stack on top of it.
 */
export function ActionSheet({
  open,
  onClose,
  title,
  subtitle,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  actions: ActionSheetAction[];
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} hideClose>
      <div className="flex flex-col gap-2.5 pt-1">
        {actions.map(({ label, onSelect, tone = 'default', icon: Icon, disabled }) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => {
              onClose();
              onSelect();
            }}
            className={cn(
              'w-full',
              tone === 'danger' ? 'btn-danger' : tone === 'danger-soft' ? 'btn-danger-soft' : 'btn-ghost',
            )}
          >
            {Icon && <Icon width={18} height={18} />}
            {label}
          </button>
        ))}
        <button type="button" onClick={onClose} className="btn-ghost w-full">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
