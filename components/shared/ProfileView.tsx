'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { PasswordField } from './PasswordField';
import { Avatar } from './Avatar';
import { LogOut, Lock, Check, Moon, CalendarOff, ChevronRight, UserIcon, Camera } from './Icons';
import { NotificationSettings } from './NotificationSettings';
import { SegmentedControl } from './SegmentedControl';
import { useTheme, type ThemePreference } from './ThemeProvider';
import { apiFetch } from '@/lib/api-client';
import { uploadFile } from '@/lib/upload-client';
import { avatarPath } from '@/lib/upload-path';
import { squareImageFile } from '@/lib/image-resize';

type Props = {
  userId: string;
  name: string;
  email: string;
  role: 'member' | 'leader';
  section: string | null;
  part: string | null;
  image: string | null;
  isSuperAdmin: boolean;
};

export function ProfileView({ userId, name, role, part, image }: Props) {
  const roleChip = [part, role].filter(Boolean).join(' · ');
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<string | null>(image);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = '';
    if (!file) return;

    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const square = await squareImageFile(file);
      // A timestamped name busts any CDN/browser cache when replacing the photo.
      const path = avatarPath(userId, `${Date.now()}.jpg`);
      const url = await uploadFile(path, square);
      const { image: saved } = await apiFetch<{ image: string }>('/api/profile/avatar', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      setAvatar(saved);
      router.refresh();
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not update your photo.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      await apiFetch('/api/profile/avatar', { method: 'DELETE' });
      setAvatar(null);
      router.refresh();
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not remove your photo.');
    } finally {
      setPhotoBusy(false);
    }
  }

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
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickPhoto}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={photoBusy}
            aria-label={avatar ? 'Change profile photo' : 'Add profile photo'}
            className="row-press relative block rounded-[32px] disabled:opacity-70"
          >
            <Avatar
              image={avatar}
              alt={name}
              className="grid h-[88px] w-[88px] place-items-center rounded-[32px] font-display text-[34px] font-semibold text-white shadow-[0_16px_40px_-18px_rgba(74,89,56,0.7)]"
              style={{ background: 'linear-gradient(150deg, #5E7048, #3c4a2c)' }}
            >
              {name.slice(0, 1).toUpperCase()}
            </Avatar>
            <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-surface bg-accent text-white">
              <Camera width={16} height={16} />
            </span>
          </button>
        </div>
        <p className="mt-4 font-display text-2xl font-semibold">{name}</p>
        <span className="chip mt-2 bg-accent/10 capitalize text-accent-ink dark:text-accent-on">{roleChip}</span>
        {photoBusy && <p className="mt-2 text-sm text-ink-faint">Updating photo…</p>}
        {photoError && (
          <p role="alert" className="mt-2 text-sm font-semibold text-bad">
            {photoError}
          </p>
        )}
        {avatar && !photoBusy && (
          <button
            type="button"
            onClick={removePhoto}
            className="row-press mt-2 text-sm font-semibold text-ink-faint"
          >
            Remove photo
          </button>
        )}
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
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft">
                <UserIcon width={18} height={18} />
              </span>
              <div>
                <p className="font-semibold">Profile</p>
                <p className="text-sm text-ink-faint">Update name or picture.</p>
              </div>
            </div>
            <button className="btn-ghost" type="button">
              Edit
            </button>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft">
                  <Lock width={18} height={18} />
                </span>
                <div>
                  <p className="font-semibold">Password</p>
                  <p className="text-sm text-ink-faint">At least 8 characters.</p>
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
