'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { PasswordField } from './PasswordField';
import { LogOut, Lock, Check } from './Icons';
import { NotificationSettings } from './NotificationSettings';
import { apiFetch } from '@/lib/api-client';

type Props = {
  name: string;
  email: string;
  role: 'member' | 'leader';
  section: string | null;
  part: string | null;
  isSuperAdmin: boolean;
};

export function ProfileView({ name, email, section, part }: Props) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) return setError('New passwords do not match.');
    if (next.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    try {
      await apiFetch('/api/profile/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next, confirm }),
      });
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 pt-2">
      <header>
        <div className="eyebrow">Your account</div>
        <h1 className="page-title mt-2">Profile</h1>
      </header>

      <section className="card p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 font-display text-2xl font-semibold text-accent-ink">
            {name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="font-display text-xl font-semibold">{name}</p>
            <p className="text-sm text-ink-soft">{email}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3">
          <ReadOnly label="Section" value={section ?? '—'} />
          <ReadOnly label="Part" value={part ?? '—'} />
        </dl>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft">
              <Lock width={18} height={18} />
            </span>
            <div>
              <p className="font-semibold">Password</p>
              <p className="text-sm text-ink-faint">Change your password.<br />This can&apos;t be undone.</p>
            </div>
          </div>
          {!open && (
            <button className="btn-ghost" onClick={() => setOpen(true)} type="button">
              Change
            </button>
          )}
        </div>

        {done && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-good">
            <Check width={16} height={16} /> Password updated.
          </p>
        )}

        {open && (
          <form onSubmit={changePassword} className="mt-4 space-y-4">
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
            <PasswordField
              label="New password"
              autoComplete="new-password"
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
            <div className="flex gap-3">
              <button type="button" className="btn-ghost flex-1" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={busy}>
                {busy ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </form>
        )}
      </section>

      <NotificationSettings />

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="row-press flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-5 py-3.5 font-semibold text-bad"
      >
        <LogOut width={19} height={19} /> Sign out
      </button>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-4 py-3">
      <dt className="label">{label}</dt>
      <dd className="mt-1 font-semibold text-ink">{value}</dd>
    </div>
  );
}
