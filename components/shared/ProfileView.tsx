'use client';

import { useRef, useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { PasswordField } from './PasswordField';
import { TextField } from './Field';
import { MemberAvatar } from './Avatar';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { LogOut, Lock, Check, Moon, CalendarOff, ChevronRight, UserIcon, Camera, Trash } from './Icons';
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

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** Settings row (CMP-11): 36px icon chip, title + sub, a trailing control. */
function SettingsRow({ icon: I, title, sub, trailing }: { icon: Icon; title: string; sub: string; trailing?: ReactNode }) {
  return (
    <div className="flex min-h-[68px] items-center gap-3 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft">
        <I width={18} height={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="row-title block">{title}</span>
        <span className="block text-sm text-ink-faint">{sub}</span>
      </span>
      {trailing}
    </div>
  );
}

/**
 * Profile (members) / Settings (leaders), PR-1: who you are, then
 * preferences, then account. Tapping the avatar or "Edit" opens the Edit
 * profile sheet (rename, change or remove your photo). Only the display name
 * changes here: email is the sign-in and what GroupMe and other matching keys
 * on, so it isn't editable.
 */
export function ProfileView({ userId, name: initialName, role, part, image }: Props) {
  const roleChip = [part, role].filter(Boolean).join(' · ');
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState<string | null>(image);
  const [editing, setEditing] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
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
    <div className="space-y-6">
      <header className="flex flex-col items-center gap-2.5 pt-2 text-center">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit profile"
          className="relative block rounded-full transition-transform duration-150 active:scale-[0.97]"
        >
          <MemberAvatar name={name} image={avatar} size={88} className="shadow-card-lg" />
          <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-fg ring-2 ring-app">
            <Camera width={16} height={16} />
          </span>
        </button>
        <p className="font-display text-2xl font-semibold leading-[30px]">{name}</p>
        <span className="chip bg-accent-soft capitalize text-accent-ink">{roleChip}</span>
      </header>

      {/* Preferences: Appearance · My Availability · Notifications */}
      <section className="card divide-y divide-line overflow-hidden">
        <div className="p-4">
          <SettingsRowInline icon={Moon} title="Appearance" sub="Auto follows your device setting." />
          <AppearanceControl />
        </div>

        <Link
          href={role === 'leader' ? '/dashboard/availability' : '/home/availability'}
          className="row-press block"
        >
          <SettingsRow
            icon={CalendarOff}
            title="My Availability"
            sub="Mark days you can’t serve."
            trailing={<ChevronRight width={18} height={18} className="shrink-0 text-ink-faint" />}
          />
        </Link>

        <NotificationSettings />
      </section>

      {/* Account: Profile · Password */}
      <section className="card divide-y divide-line overflow-hidden">
        <SettingsRow
          icon={UserIcon}
          title="Profile"
          sub="Update your name or picture."
          trailing={
            <button className="btn-outline btn-sm shrink-0" type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
          }
        />

        <div>
          <SettingsRow
            icon={Lock}
            title="Password"
            sub="At least 8 characters."
            trailing={
              !open && (
                <button className="btn-outline btn-sm shrink-0" onClick={() => setOpen(true)} type="button">
                  Change
                </button>
              )
            }
          />

          {done && (
            <p className="-mt-1 inline-flex items-center gap-1.5 px-4 pb-4 text-sm font-semibold text-good-ink">
              <Check width={16} height={16} /> Password updated.
            </p>
          )}

          {open && (
            <form onSubmit={changePassword} className="space-y-4 px-4 pb-4">
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
              {error && <p role="alert" className="text-[13px] font-semibold text-bad-ink">{error}</p>}
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
      </section>

      <button type="button" onClick={() => setConfirmSignOut(true)} className="btn-danger-text w-full">
        <LogOut width={18} height={18} /> Sign out
      </button>

      <EditProfileSheet
        open={editing}
        onClose={() => setEditing(false)}
        userId={userId}
        name={name}
        avatar={avatar}
        onName={(n) => {
          setName(n);
          router.refresh();
        }}
        onAvatar={(a) => {
          setAvatar(a);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        message="You’ll need your email and password to sign back in."
        confirmLabel="Sign out"
        destructive={false}
        onConfirm={() => signOut({ callbackUrl: '/login' })}
        onClose={() => setConfirmSignOut(false)}
      />
    </div>
  );
}

/** The Appearance row's heading (its control sits below, full width). */
function SettingsRowInline({ icon: I, title, sub }: { icon: Icon; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft">
        <I width={18} height={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="row-title block">{title}</span>
        <span className="block text-sm text-ink-faint">{sub}</span>
      </span>
    </div>
  );
}

/**
 * Edit profile (NEW-4): change or remove your photo (same picker + square crop
 * as before) and rename yourself. Photo changes save on their own; the name
 * saves with "Save changes".
 */
function EditProfileSheet({
  open,
  onClose,
  userId,
  name,
  avatar,
  onName,
  onAvatar,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  name: string;
  avatar: string | null;
  onName: (name: string) => void;
  onAvatar: (url: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(name);
  const [photoBusy, setPhotoBusy] = useState<'updating' | 'removing' | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the current name each time the sheet opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(name);
      setError(null);
      setPhotoError(null);
    }
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = '';
    if (!file) return;

    setPhotoError(null);
    setPhotoBusy('updating');
    try {
      const square = await squareImageFile(file);
      // A timestamped name busts any CDN/browser cache when replacing the photo.
      const path = avatarPath(userId, `${Date.now()}.jpg`);
      const url = await uploadFile(path, square);
      const { image: saved } = await apiFetch<{ image: string }>('/api/profile/avatar', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      onAvatar(saved);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not update your photo.');
    } finally {
      setPhotoBusy(null);
    }
  }

  async function removePhoto() {
    setPhotoError(null);
    setPhotoBusy('removing');
    try {
      await apiFetch('/api/profile/avatar', { method: 'DELETE' });
      onAvatar(null);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not remove your photo.');
    } finally {
      setPhotoBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim().replace(/\s+/g, ' ');
    if (!trimmed) return setError('Name is required.');
    if (trimmed === name) return onClose();
    setSaving(true);
    setError(null);
    try {
      const { name: saved } = await apiFetch<{ name: string }>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed }),
      });
      onName(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit profile">
      <form onSubmit={save} className="space-y-5">
        <div className="flex items-center gap-4">
          <MemberAvatar name={draft || name} image={avatar} size={72} />
          <div className="flex flex-col items-start gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={!!photoBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera width={16} height={16} />
              {photoBusy === 'updating' ? 'Updating photo…' : 'Change photo'}
            </button>
            {avatar && (
              <button type="button" className="btn-danger-soft btn-sm" disabled={!!photoBusy} onClick={removePhoto}>
                <Trash width={16} height={16} />
                {photoBusy === 'removing' ? 'Removing photo…' : 'Remove photo'}
              </button>
            )}
          </div>
        </div>
        {photoError && (
          <p role="alert" className="text-[13px] font-semibold text-bad-ink">
            {photoError}
          </p>
        )}

        <TextField
          label="Name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="name"
          maxLength={120}
          enterKeyHint="done"
          error={error}
        />

        <button type="submit" className="btn-primary w-full" disabled={saving || !!photoBusy}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Modal>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Auto' },
  { value: 'dark', label: 'Dark' },
];

function AppearanceControl() {
  const { theme, setTheme } = useTheme();
  return (
    <SegmentedControl className="mt-4" aria-label="Appearance" options={THEME_OPTIONS} value={theme} onChange={setTheme} />
  );
}
