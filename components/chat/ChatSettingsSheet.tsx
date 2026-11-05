'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ChatDetailDTO, ChatMemberDTO } from '@/lib/chat/types';
import { CHAT_NAME_MAX } from '@/lib/chat/types';
import { apiFetch } from '@/lib/api-client';
import { Modal } from '@/components/shared/Modal';
import { Switch } from '@/components/shared/Switch';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { BellOff, Plus, X } from '@/components/shared/Icons';
import { ChatAvatar } from './ChatAvatar';
import { MemberPicker, useChatPeople } from './MemberPicker';
import { NewTopicSheet } from './NewTopicSheet';

/**
 * Chat settings: mute (everyone); topics + add people + rename (super admin +
 * leaders); remove people + archive, and delete once archived (moderators). The server enforces each of
 * these — `detail.can` only decides what's shown.
 */
export function ChatSettingsSheet({
  base,
  meId,
  detail,
  onChange,
  onClose,
}: {
  base: string;
  meId: string;
  detail: ChatDetailDTO;
  onChange: (d: ChatDetailDTO) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ChatMemberDTO | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [name, setName] = useState(detail.name);
  const router = useRouter();
  const isTopic = detail.parent !== null;
  const archivedTopics = detail.topics.filter((t) => t.archived);
  const showPush = detail.members.some((m) => m.hasPush !== undefined);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const patch = (body: object) =>
    run(async () => {
      const r = await apiFetch<{ chat?: ChatDetailDTO }>(`/api/chat/${detail.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      if (r.chat) onChange(r.chat);
      return r;
    });

  const reload = async () => onChange((await apiFetch<{ chat: ChatDetailDTO }>(`/api/chat/${detail.id}`)).chat);

  return (
    <>
      <Modal open onClose={onClose} title={isTopic ? `# ${detail.name}` : detail.name}>
        <div className="space-y-6">
          {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}

          {/* Mute — per chat, covers its topics */}
          <section className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Mute notifications</p>
              <p className="text-sm text-ink-soft">
                {isTopic ? `Mutes all of ${detail.parent!.name}, topics included.` : 'Stops pushes from this chat and its topics.'}
              </p>
            </div>
            <Switch checked={detail.muted} disabled={busy} onChange={(v) => patch({ muted: v })} aria-label="Mute notifications" />
          </section>

          {/* Topics — the live ones are listed on the chat's page; here: make one, or reach an archived one to restore */}
          {(archivedTopics.length > 0 || detail.can.createTopic) && (
            <section className="space-y-2">
              <h3 className="label">Topics</h3>
              {archivedTopics.length > 0 && (
                <ul className="divide-y divide-line rounded-2xl border border-line">
                  {archivedTopics.map((t) => (
                    <li key={t.id}>
                      <Link href={`${base}/chat/${t.id}`} onClick={onClose} className="row-press flex items-center gap-2 px-4 py-2.5">
                        <span className="text-ink-faint">#</span>
                        <span className="flex-1 truncate font-semibold">{t.name}</span>
                        <span className="chip bg-surface-2 text-ink-faint">Archived</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {detail.can.createTopic && (
                <button type="button" className="btn-ghost w-full" onClick={() => setCreatingTopic(true)}>
                  <Plus width={16} height={16} /> New topic
                </button>
              )}
            </section>
          )}

          {/* Members */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="label">{detail.members.length} {detail.members.length === 1 ? 'member' : 'members'}</h3>
              {detail.can.addMembers && (
                <button type="button" className="text-sm font-semibold text-accent dark:text-accent-on" onClick={() => setAdding(true)}>
                  Add people
                </button>
              )}
            </div>
            <ul className="divide-y divide-line">
              {detail.members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 py-2">
                  <ChatAvatar name={m.name} image={m.image} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {m.name}
                      {m.userId === meId && <span className="font-normal text-ink-faint"> (you)</span>}
                    </span>
                    {m.status === 'pending' && <span className="text-xs text-ink-faint">Invited — hasn’t joined Hub yet</span>}
                  </span>
                  {m.hasPush === false && (
                    <BellOff width={16} height={16} className="shrink-0 text-warn" aria-label="No notifications set up" />
                  )}
                  {detail.can.removeMembers && m.userId !== meId && (
                    <button
                      type="button"
                      className="row-press grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-faint"
                      aria-label={`Remove ${m.name}`}
                      onClick={() => setRemoving(m)}
                    >
                      <X width={16} height={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {showPush && detail.members.some((m) => m.hasPush === false) && (
              <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                <BellOff width={13} height={13} className="text-warn" /> = no device set up for notifications yet
              </p>
            )}
          </section>

          {/* Rename */}
          {detail.can.rename && (
            <section className="space-y-2">
              <h3 className="label">{isTopic ? 'Topic name' : 'Chat name'}</h3>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim() && name.trim() !== detail.name) void patch({ name: name.trim() });
                }}
              >
                <input
                  className="field py-2.5"
                  aria-label={isTopic ? 'Topic name' : 'Chat name'}
                  maxLength={CHAT_NAME_MAX}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button type="submit" className="btn-ghost shrink-0" disabled={busy || !name.trim() || name.trim() === detail.name}>
                  Save
                </button>
              </form>
            </section>
          )}

          {/* Archive */}
          {detail.can.archive && (
            <section>
              <button
                type="button"
                className="btn-ghost w-full text-bad"
                disabled={busy}
                onClick={() => (detail.archived ? patch({ archived: false }) : setArchiving(true))}
              >
                {detail.archived ? `Restore this ${isTopic ? 'topic' : 'chat'}` : `Archive this ${isTopic ? 'topic' : 'chat'}`}
              </button>
              {detail.can.delete && (
                <button type="button" className="btn-ghost mt-2 w-full text-bad" disabled={busy} onClick={() => setDeleting(true)}>
                  Delete permanently
                </button>
              )}
            </section>
          )}
        </div>
      </Modal>

      {creatingTopic && (
        <NewTopicSheet
          chatId={detail.rootId}
          onClose={() => setCreatingTopic(false)}
          onCreated={(id) => {
            onClose();
            router.push(`${base}/chat/${id}`);
          }}
        />
      )}

      {adding && (
        <AddPeopleSheet
          detail={detail}
          onClose={() => setAdding(false)}
          onAdded={async () => {
            setAdding(false);
            await run(reload);
          }}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Remove from chat?"
        message={`${removing?.name ?? ''} will lose access to ${detail.parent?.name ?? detail.name} and its topics. Their past messages stay.`}
        confirmLabel="Remove"
        busy={busy}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          void run(async () => {
            await apiFetch(`/api/chat/${detail.id}/members/${removing!.userId}`, { method: 'DELETE' });
            setRemoving(null);
            await reload();
          })
        }
      />

      <ConfirmDialog
        open={archiving}
        title={`Archive this ${isTopic ? 'topic' : 'chat'}?`}
        message={`It disappears from everyone’s chat list and becomes read-only. Moderators can restore it later.`}
        confirmLabel="Archive"
        busy={busy}
        onClose={() => setArchiving(false)}
        onConfirm={() => void patch({ archived: true }).then(() => setArchiving(false))}
      />

      <ConfirmDialog
        open={deleting}
        title={`Delete this ${isTopic ? 'topic' : 'chat'} permanently?`}
        message={`Every message, photo and video in it${isTopic ? '' : ', topics included,'} is deleted for everyone. This can’t be undone.`}
        confirmLabel="Delete"
        busy={busy}
        onClose={() => setDeleting(false)}
        onConfirm={() =>
          void run(async () => {
            await apiFetch(`/api/chat/${detail.id}`, { method: 'DELETE' });
            onClose();
            router.replace(isTopic ? `${base}/chat/${detail.rootId}` : `${base}/chat`);
          })
        }
      />
    </>
  );
}

function AddPeopleSheet({ detail, onClose, onAdded }: { detail: ChatDetailDTO; onClose: () => void; onAdded: () => void }) {
  const { people, error: loadError } = useChatPeople();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inChat = new Set(detail.members.map((m) => m.userId));

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/chat/${detail.id}/members`, { method: 'POST', body: JSON.stringify({ userIds: [...selected] }) });
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add them.');
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add people"
      footer={
        <div className="space-y-2">
          {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
          <button type="button" className="btn-primary w-full" disabled={busy || selected.size === 0} onClick={add}>
            {busy ? 'Adding…' : selected.size ? `Add ${selected.size} ${selected.size === 1 ? 'person' : 'people'}` : 'Add'}
          </button>
        </div>
      }
    >
      {loadError ? (
        <p className="text-sm font-semibold text-bad">{loadError}</p>
      ) : !people ? (
        <p className="text-sm text-ink-faint">Loading people…</p>
      ) : (
        <MemberPicker
          people={people}
          exclude={inChat}
          selected={selected}
          onToggle={(id) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
      )}
    </Modal>
  );
}
