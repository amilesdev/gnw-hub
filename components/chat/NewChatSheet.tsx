'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/shared/Modal';
import { TextField } from '@/components/shared/Field';
import { apiFetch } from '@/lib/api-client';
import { CHAT_NAME_MAX } from '@/lib/chat/types';
import { MemberPicker, useChatPeople } from './MemberPicker';

/** Leader "New chat": a name + who's in it. You're added automatically. */
export function NewChatSheet({ base, meId, onClose }: { base: string; meId: string; onClose: () => void }) {
  const router = useRouter();
  const { people, error: loadError } = useChatPeople();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function create() {
    if (!name.trim()) return setError('Give the chat a name.');
    setBusy(true);
    setError(null);
    try {
      const { id } = await apiFetch<{ id: string }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), memberIds: [...selected] }),
      });
      router.push(`${base}/chat/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the chat.');
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New chat"
      footer={
        <div className="space-y-2">
          {error && <p role="alert" className="text-sm font-semibold text-bad-ink">{error}</p>}
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={create}>
            {busy ? 'Creating…' : `Create chat${selected.size ? ` with ${selected.size} ${selected.size === 1 ? 'person' : 'people'}` : ''}`}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <TextField
          label="Chat name"
          maxLength={CHAT_NAME_MAX}
          placeholder="e.g. GNW Band"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="space-y-2">
          <span className="label">Who’s in it</span>
          {loadError ? (
            <p className="text-sm font-semibold text-bad-ink">{loadError}</p>
          ) : !people ? (
            <p className="text-sm text-ink-faint">Loading people…</p>
          ) : (
            <MemberPicker people={people} selected={selected} onToggle={toggle} exclude={new Set([meId])} />
          )}
        </div>
      </div>
    </Modal>
  );
}
