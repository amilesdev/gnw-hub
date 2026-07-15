'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/shared/Modal';
import { TextField } from '@/components/shared/Field';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { apiFetch } from '@/lib/api-client';
import type { CallDTO } from '@/lib/serialize';

type Audience = 'all_members' | 'leaders_only';

export function StartCallModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [audience, setAudience] = useState<Audience>('all_members');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Give the call a name.');
    setBusy(true);
    try {
      const { call } = await apiFetch<{ call: CallDTO }>('/api/calls', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), audience }),
      });
      // Hand off to the call page, which requests its own token and connects.
      router.push(`/call/${call.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the call.');
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Start a call" placement="center">
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="Call name"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Quick Check-In"
          enterKeyHint="go"
        />

        <div className="space-y-1.5">
          <span className="text-sm font-semibold text-ink-soft">Who can join</span>
          <SegmentedControl<Audience>
            value={audience}
            onChange={setAudience}
            options={[
              { value: 'all_members', label: 'All Members' },
              { value: 'leaders_only', label: 'Leaders Only' },
            ]}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled
            title="Coming soon"
            aria-disabled="true"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 font-semibold text-ink-faint opacity-60"
          >
            Invite
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={busy || !name.trim()}>
            {busy ? 'Starting…' : 'Start Call'}
          </button>
        </div>

        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
      </form>
    </Modal>
  );
}
