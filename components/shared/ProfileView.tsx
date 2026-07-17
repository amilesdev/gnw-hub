'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { PasswordField } from './PasswordField';
import { LogOut, Lock, Check, Moon, CalendarOff, ChevronRight, UserIcon } from './Icons';
import { NotificationSettings } from './NotificationSettings';
import { SegmentedControl } from './SegmentedControl';
import { useTheme, type ThemePreference } from './ThemeProvider';
import { apiFetch } from '@/lib/api-client';

type Props = {
  name: string;
  email: string;
  role: 'member' | 'leader';
  section: string | null;
  part: string | null;
  isSuperAdmin: boolean;
};

export function ProfileView({ name, role, part }: Props) {
  const roleChip = [part, role].filter(Boolean).join(' · ');
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
    <div className="space-y-6 pt-2">
      <header className="flex flex-col items-center pt-2 text-center">
        <div
          className="grid h-20 w-20 place-items-center rounded-[28px] font-display text-3xl font-semibold text-white shadow-[0_16px_40px_-18px_rgba(74,89,56,0.7)]"
          style={{ background: 'linear-gradient(150deg, var(--accent), #3c4a2c)' }}
        >
          {name.slice(0, 1).toUpperCase()}
        </div>
        <p className="mt-4 font-display text-2xl font-semibold">{name}</p>
        <span className="chip mt-2 bg-accent/10 capitalize text-accent-ink dark:text-accent-on">{roleChip}</span>
      </header>

      {/* Preferences group: Appearance · My Availability · Notifications */}
      <section className="card overflow-hidden">
        <div className="divide-y divide-line">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft">
                <Moon width={18} height={18} />
              </span>
              <div>
                <p className="font-semibold">Appearance</p>
                <p className="text-sm text-ink-faint">Auto follows your device setting.</p>
              </div>
            </div>
            <AppearanceControl />
          </div>

          <Link
            href={role === 'leader' ? '/dashboard/availability' : '/home/availability'}
            className="row-press flex items-center justify-between p-5"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft">
                <CalendarOff width={18} height={18} />
              </span>
              <div>
                <p className="font-semibold">My Availability</p>
                <p className="text-sm text-ink-faint">Mark days you can’t serve.</p>
              </div>
            </div>
            <ChevronRight width={20} height={20} className="text-ink-faint" />
          </Link>

          <NotificationSettings />
        </div>
      </section>

      {/* Account group: Edit Profile · Password */}
      <section className="card overflow-hidden">
        <div className="divide-y divide-line">
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-faint">
                <UserIcon width={18} height={18} />
              </span>
              <div>
                <p className="font-semibold text-ink-soft">Edit Profile</p>
                <p className="text-sm text-ink-faint">Update your name and voice part.</p>
              </div>
            </div>
            <span className="chip bg-surface-2 text-ink-faint">Coming soon</span>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft">
                  <Lock width={18} height={18} />
                </span>
                <div>
                  <p className="font-semibold">Password</p>
                  <p className="text-sm text-ink-faint">Change your password.<br />At least 8 characters.</p>
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
                  enterKeyHint="next"
                />
                <PasswordField
                  label="New password"
                  autoComplete="new-password"
                  required
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  enterKeyHint="next"
                />
                <PasswordField
                  label="Confirm new password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  enterKeyHint="done"
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
          </div>
        </div>
      </section>

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

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Auto' },
  { value: 'dark', label: 'Dark' },
];

function AppearanceControl() {
  const { theme, setTheme } = useTheme();
  return <SegmentedControl className="mt-4" options={THEME_OPTIONS} value={theme} onChange={setTheme} />;
}
