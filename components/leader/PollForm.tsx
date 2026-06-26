'use client';

import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { TextField, FieldLabel } from '@/components/shared/Field';
import { Switch } from '@/components/shared/Switch';
import { Plus, X } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { toLocalInput, minExpiry } from '@/lib/announcement-ui';

const MAX_CHOICES = 10;

function defaultEnds(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1); // default: closes in 24 hours
  return toLocalInput(d);
}

export function PollForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [endsAt, setEndsAt] = useState(defaultEnds());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setChoice = (i: number, value: string) =>
    setChoices((cs) => cs.map((c, idx) => (idx === i ? value : c)));
  const addChoice = () => setChoices((cs) => (cs.length < MAX_CHOICES ? [...cs, ''] : cs));
  const removeChoice = (i: number) => setChoices((cs) => cs.filter((_, idx) => idx !== i));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!question.trim()) return setError('Add a question.');
    if (choices.map((c) => c.trim()).filter(Boolean).length < 2) return setError('Add at least two choices.');
    setBusy(true);
    try {
      await apiFetch('/api/polls', {
        method: 'POST',
        body: JSON.stringify({
          question,
          choices,
          multiple,
          endsAt: new Date(endsAt).toISOString(),
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post the poll.');
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New Poll">
      <form onSubmit={submit} className="space-y-5">
        <TextField
          label="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What’s your question?"
        />

        <div className="space-y-2">
          <FieldLabel>Choices</FieldLabel>
          {choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="field flex-1"
                value={c}
                onChange={(e) => setChoice(i, e.target.value)}
                placeholder={`Choice ${i + 1}`}
              />
              {choices.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeChoice(i)}
                  className="row-press grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft"
                  aria-label={`Remove choice ${i + 1}`}
                >
                  <X width={16} height={16} />
                </button>
              )}
            </div>
          ))}
          {choices.length < MAX_CHOICES && (
            <button
              type="button"
              onClick={addChoice}
              className="row-press inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold text-ink-soft"
            >
              <Plus width={16} height={16} /> Add More
            </button>
          )}
        </div>

        <div className="space-y-3">
          <FieldLabel>Settings</FieldLabel>
          <div className="min-w-0">
            <TextField
              label="Ends"
              type="datetime-local"
              required
              value={endsAt}
              min={minExpiry()}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
            <span>
              <span className="block font-semibold">Multiple answers</span>
              <span className="block text-xs text-ink-faint">Let people pick more than one choice.</span>
            </span>
            <Switch checked={multiple} onChange={setMultiple} aria-label="Allow multiple answers" />
          </label>
        </div>

        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Posting…' : 'Post poll'}
        </button>
      </form>
    </Modal>
  );
}
