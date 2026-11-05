'use client';

import { useState } from 'react';
import { CHAT_NAME_MAX } from '@/lib/chat/types';
import { apiFetch } from '@/lib/api-client';
import { Modal } from '@/components/shared/Modal';
import { TextField } from '@/components/shared/Field';

/** "+ New topic": a name, then straight into the new topic. */
export function NewTopicSheet({
  chatId,
  onClose,
  onCreated,
}: {
  chatId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return setError('Give the topic a name.');
    setBusy(true);
    setError(null);
    try {
      const { id } = await apiFetch<{ id: string }>(`/api/chat/${chatId}/topics`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      onCreated(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the topic.');
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New topic"
      footer={
        <div className="space-y-2">
          {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
          <button type="button" className="btn-primary w-full" disabled={busy || !name.trim()} onClick={create}>
            {busy ? 'Creating…' : 'Create topic'}
          </button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <TextField
          label="Topic name"
          placeholder="e.g. Attire"
          maxLength={CHAT_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <p className="mt-2 text-sm text-ink-soft">Everyone in the chat can see and post in it.</p>
      </form>
    </Modal>
  );
}
