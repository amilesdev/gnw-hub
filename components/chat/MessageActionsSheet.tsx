'use client';

import { useState } from 'react';
import { QUICK_REACTIONS, isSingleEmoji, withinEditWindow } from '@/lib/chat/types';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Pencil, Pin, Plus, Trash } from '@/components/shared/Icons';
import type { ClientMessage } from './ChatMessages';
import { snippet } from './ChatComposer';
import { EMOJI_GROUPS } from './emoji';

/**
 * Long-press / "⋯" sheet for one message: react (quick row or the full
 * picker), see who reacted, and Reply · Copy · Edit · Pin · Delete — each shown
 * only when allowed (the server enforces the same rules).
 */
export function MessageActionsSheet({
  message: m,
  meId,
  canModerate,
  readOnly,
  onClose,
  onReact,
  onReply,
  onEdit,
  onPin,
  onDelete,
}: {
  message: ClientMessage;
  meId: string;
  canModerate: boolean;
  /** Archived chat: look, copy, nothing else. */
  readOnly: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onPin: (pinned: boolean) => void;
  onDelete: () => void;
}) {
  const [picker, setPicker] = useState(false);
  const [custom, setCustom] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const mine = m.author?.id === meId;
  const canEdit = mine && !readOnly && withinEditWindow(m.createdAt) && !m.deleted;
  const canDelete = !readOnly && (mine || canModerate);
  const myEmojis = new Set(m.reactions.filter((r) => r.mine).map((r) => r.emoji));

  const react = (emoji: string) => {
    onReact(emoji);
    onClose();
  };

  return (
    <>
      <Modal open={!confirming} onClose={onClose} title={m.author?.name ?? m.importedAuthorName ?? 'Message'}>
        <div className="space-y-5">
          <p className="line-clamp-3 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[15px] text-ink-soft">{snippet(m)}</p>

          {!readOnly && (
            <div>
              <div className="flex items-center justify-between gap-1">
                {QUICK_REACTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => react(e)}
                    aria-pressed={myEmojis.has(e)}
                    className={cn(
                      'grid h-12 w-12 place-items-center rounded-full text-[1.6rem] transition active:scale-90',
                      myEmojis.has(e) ? 'bg-accent/20 ring-2 ring-accent' : 'bg-surface-2',
                    )}
                  >
                    {e}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPicker((v) => !v)}
                  aria-label="More reactions"
                  aria-expanded={picker}
                  className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-soft"
                >
                  <Plus width={20} height={20} />
                </button>
              </div>

              {picker && (
                <div className="mt-4 space-y-3">
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (isSingleEmoji(custom.trim())) react(custom.trim());
                    }}
                  >
                    <input
                      className="field py-2.5 text-xl"
                      placeholder="Type any emoji"
                      aria-label="Type any emoji"
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                    />
                    <button type="submit" className="btn-ghost shrink-0" disabled={!isSingleEmoji(custom.trim())}>
                      React
                    </button>
                  </form>
                  {EMOJI_GROUPS.map((g) => (
                    <div key={g.label}>
                      <p className="label mb-1.5">{g.label}</p>
                      <div className="grid grid-cols-8 gap-1">
                        {g.emojis.map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => react(e)}
                            className={cn('grid aspect-square place-items-center rounded-xl text-2xl active:scale-90', myEmojis.has(e) && 'bg-accent/20')}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {m.reactions.length > 0 && (
            <div className="space-y-1.5">
              <p className="label">Reactions</p>
              {m.reactions.map((r) => (
                <p key={r.emoji} className="text-sm">
                  <span className="mr-2 text-lg">{r.emoji}</span>
                  <span className="text-ink-soft">{r.names.join(', ')}</span>
                </p>
              ))}
            </div>
          )}

          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {!readOnly && (
              <Action
                label="Reply"
                icon={<span aria-hidden>↩</span>}
                onClick={() => {
                  onReply();
                  onClose();
                }}
              />
            )}
            {m.text && (
              <Action
                label={copied ? 'Copied' : 'Copy text'}
                icon={<span aria-hidden>⧉</span>}
                onClick={() => {
                  void navigator.clipboard?.writeText(m.text ?? '').then(() => setCopied(true));
                  window.setTimeout(onClose, 500);
                }}
              />
            )}
            {canEdit && (
              <Action
                label="Edit"
                icon={<Pencil width={17} height={17} />}
                onClick={() => {
                  onEdit();
                  onClose();
                }}
              />
            )}
            {!readOnly && (
              <Action
                label={m.pinnedAt ? 'Unpin' : 'Pin'}
                icon={<Pin width={17} height={17} />}
                onClick={() => {
                  onPin(!m.pinnedAt);
                  onClose();
                }}
              />
            )}
            {canDelete && (
              <Action label="Delete" icon={<Trash width={17} height={17} />} danger onClick={() => setConfirming(true)} />
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirming}
        title="Delete message?"
        message={
          mine
            ? 'It’s replaced with “message deleted” for everyone, along with any photos or videos.'
            : `You’re deleting ${m.author?.name.split(' ')[0] ?? 'this person'}’s message as a moderator. It’s replaced with “message deleted” for everyone.`
        }
        confirmLabel="Delete"
        onClose={() => {
          setConfirming(false);
          onClose();
        }}
        onConfirm={() => {
          onDelete();
          setConfirming(false);
          onClose();
        }}
      />
    </>
  );
}

function Action({ label, icon, danger, onClick }: { label: string; icon: React.ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('row-press flex w-full items-center gap-3 px-4 py-3 text-left font-semibold', danger ? 'text-bad' : 'text-ink')}
    >
      <span className="grid w-5 place-items-center text-ink-soft">{icon}</span>
      {label}
    </button>
  );
}
