'use client';

import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/shared/Toast';
import { TextField, FieldLabel } from '@/components/shared/Field';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Plus, Pencil, Trash, Repeat, Check, Link, X } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { useDataChanged } from '@/lib/data-changed';
import { isInviteExpired } from '@/lib/invites';

export type Section = 'Vocalist' | 'Band';
export type Part = 'Soprano' | 'Alto' | 'Tenor' | 'Keys' | 'Guitar' | 'Bass' | 'Drums';

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: 'member' | 'leader';
  section: Section | null;
  part: Part | null;
  status: 'pending' | 'active';
  image: string | null;
  isSuperAdmin: boolean;
  inviteExpiry: string | null;
  inviteUrl: string | null;
};

const SECTIONS: Section[] = ['Vocalist', 'Band'];
const PARTS_BY_SECTION: Record<Section, Part[]> = {
  Vocalist: ['Soprano', 'Alto', 'Tenor'],
  Band: ['Keys', 'Guitar', 'Bass', 'Drums'],
};

export function MembersManager({ initialMembers }: { initialMembers: MemberRow[] }) {
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [confirming, setConfirming] = useState<MemberRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Notice banner (CMP-16): success, or error when something went wrong.
  const [notice, setNoticeState] = useState<{ text: string; error: boolean } | null>(null);
  const setNotice = (text: string | null, error = false) => setNoticeState(text ? { text, error } : null);
  const toast = useToast();

  async function refresh() {
    const { members } = await apiFetch<{ members: MemberRow[] }>('/api/members');
    setMembers(members);
  }

  // Another leader's change, picked up when the app comes back to the front.
  useDataChanged(() => {
    refresh().catch(() => {});
  });

  async function copyInviteLink(m: MemberRow) {
    if (!m.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(m.inviteUrl);
      toast.show({ message: 'Link copied.' });
    } catch {
      // Clipboard API can be blocked (e.g. non-HTTPS); show the link to copy by hand.
      setNotice(`Copy this invite link for ${m.name}: ${m.inviteUrl}`);
    }
  }

  async function reinvite(m: MemberRow) {
    setBusyId(m.id);
    try {
      const res = await apiFetch<{ emailSkipped: boolean; emailSent: boolean; emailError?: string }>(`/api/members/${m.id}/reinvite`, { method: 'POST' });
      if (res.emailSkipped) {
        setNotice('Invite regenerated. Email isn’t configured, so the link is in the server logs.', true);
      } else if (res.emailSent) {
        setNotice(`Re-invite sent to ${m.email}.`);
      } else {
        setNotice(`Invite regenerated, but the email failed to send: ${res.emailError ?? 'unknown error'}.`, true);
      }
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not re-invite.', true);
    } finally {
      setBusyId(null);
    }
  }

  async function revoke() {
    if (!confirming) return;
    setBusyId(confirming.id);
    try {
      await apiFetch(`/api/members/${confirming.id}`, { method: 'DELETE' });
      setConfirming(null);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not revoke.', true);
    } finally {
      setBusyId(null);
    }
  }

  const pending = members.filter((m) => m.status === 'pending');
  const active = members.filter((m) => m.status === 'active');

  return (
    <div className="space-y-5">
      {/* A section of Settings (LD-7), so a section heading, not a second page title. */}
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Leader tools</div>
          <h2 className="t-title mt-1">Members</h2>
        </div>
        <button type="button" className="btn-primary btn-sm h-11" onClick={() => setInviteOpen(true)}>
          <Plus width={16} height={16} /> Invite
        </button>
      </header>

      {notice && (
        <div
          role={notice.error ? 'alert' : 'status'}
          className={
            notice.error
              ? 'flex items-center gap-3 rounded-2xl border border-bad/30 bg-bad/[0.08] py-3 pl-3.5 pr-1.5 text-[15px] font-semibold text-bad-ink'
              : 'flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.08] py-3 pl-3.5 pr-1.5 text-[15px] font-semibold text-good-ink'
          }
        >
          {notice.error ? <X width={18} height={18} className="shrink-0" /> : <Check width={18} height={18} className="shrink-0" />}
          <span className="selectable min-w-0 flex-1 break-words">{notice.text}</span>
          <button className="btn-ghost btn-sm shrink-0" onClick={() => setNotice(null)} type="button">
            Dismiss
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="eyebrow">Pending invites</h2>
          {pending.map((m) => {
            const expired = isInviteExpired(m.inviteExpiry ? new Date(m.inviteExpiry) : null);
            return (
              <div key={m.id} className="card animate-rise p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-sm text-ink-soft">{m.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.section && <span className="chip bg-surface-2 text-ink-soft">{m.section}</span>}
                      {m.part && <span className="chip bg-surface-2 text-ink-soft">{m.part}</span>}
                      {expired && <span className="chip bg-bad/15 text-bad-ink">Expired</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(m)} type="button">
                      <Pencil width={15} height={15} /> Edit
                    </button>
                    <button
                      className="btn-ghost btn-sm text-bad-ink"
                      onClick={() => setConfirming(m)}
                      type="button"
                    >
                      <Trash width={15} height={15} /> Remove
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => reinvite(m)}
                    disabled={busyId === m.id}
                    type="button"
                  >
                    <Repeat width={15} height={15} /> {expired ? 'Re-invite' : 'Resend'}
                  </button>
                  {m.inviteUrl && !expired && (
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => copyInviteLink(m)}
                      type="button"
                    >
                      <Link width={16} height={16} /> Copy link
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="eyebrow">Active members ({active.length})</h2>
        {active.map((m) => (
          <div key={m.id} className="card animate-rise p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{m.name}</p>
                <p className="text-sm text-ink-soft">{m.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.section && <span className="chip bg-surface-2 text-ink-soft">{m.section}</span>}
                  {m.part && <span className="chip bg-surface-2 text-ink-soft">{m.part}</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <button className="btn-ghost btn-sm" onClick={() => setEditing(m)} type="button">
                  <Pencil width={15} height={15} /> Edit
                </button>
                {!m.isSuperAdmin && (
                  <button
                    className="btn-ghost btn-sm text-bad-ink"
                    onClick={() => setConfirming(m)}
                    type="button"
                  >
                    <Trash width={15} height={15} /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {active.length === 0 && <p className="text-sm text-ink-faint">No active members yet.</p>}
      </section>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onDone={async (msg, error) => {
          setInviteOpen(false);
          setNotice(msg, error);
          await refresh();
        }}
      />

      {editing && (
        <EditModal
          member={editing}
          onClose={() => setEditing(null)}
          onDone={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirming}
        title={confirming?.status === 'active' ? 'Remove member?' : 'Revoke invite?'}
        message={
          confirming?.status === 'active'
            ? `This permanently removes ${confirming?.name ?? 'this person'} and their account. This can’t be undone.`
            : `This removes ${confirming?.name ?? 'this person'}’s pending invite. They won’t be able to claim it.`
        }
        confirmLabel="Remove"
        busy={busyId === confirming?.id}
        onConfirm={revoke}
        onClose={() => setConfirming(null)}
      />
    </div>
  );
}

function InviteModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (msg: string, error?: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [section, setSection] = useState<Section>('Vocalist');
  const [part, setPart] = useState<Part>('Soprano');
  const [role, setRole] = useState<'member' | 'leader'>('member');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function changeSection(next: Section) {
    setSection(next);
    setPart(PARTS_BY_SECTION[next][0]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ emailSkipped: boolean; emailSent: boolean; emailError?: string }>('/api/members', {
        method: 'POST',
        body: JSON.stringify({ name, email, section, part, role }),
      });
      if (res.emailSkipped) {
        onDone(`Invite created for ${email}. Email isn’t configured, so the link is in the server logs.`, true);
      } else if (res.emailSent) {
        onDone(`Invite sent to ${email}.`);
      } else {
        onDone(`Invite created for ${email}, but the email failed to send: ${res.emailError ?? 'unknown error'}.`, true);
      }
      setName('');
      setEmail('');
      setRole('member');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite a member">
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          autoComplete="name"
          enterKeyHint="next"
        />
        <TextField
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="them@email.com"
          autoComplete="email"
          enterKeyHint="next"
        />
        <div className="space-y-1.5">
          <FieldLabel>Section</FieldLabel>
          <SegmentedControl
            value={section}
            onChange={changeSection}
            options={SECTIONS.map((s) => ({ value: s, label: s }))}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Part</FieldLabel>
          <SegmentedControl
            value={part}
            onChange={setPart}
            options={PARTS_BY_SECTION[section].map((p) => ({ value: p, label: p }))}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Role</FieldLabel>
          <SegmentedControl
            value={role}
            onChange={setRole}
            options={[
              { value: 'member', label: 'Member' },
              { value: 'leader', label: 'Leader' },
            ]}
          />
        </div>
        {error && <p className="text-sm font-semibold text-bad-ink">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Sending…' : 'Send invite'}
        </button>
      </form>
    </Modal>
  );
}

function EditModal({
  member,
  onClose,
  onDone,
}: {
  member: MemberRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [section, setSection] = useState<Section>(member.section ?? 'Vocalist');
  const [part, setPart] = useState<Part>(member.part ?? 'Soprano');
  const [role, setRole] = useState(member.role);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function changeSection(next: Section) {
    setSection(next);
    // Keep the part valid for the new section.
    if (!PARTS_BY_SECTION[next].includes(part)) setPart(PARTS_BY_SECTION[next][0]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, section, part, role }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${member.name.split(' ')[0]}`}>
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          enterKeyHint="done"
        />
        <div className="space-y-1.5">
          <FieldLabel>Section</FieldLabel>
          <SegmentedControl
            value={section}
            onChange={changeSection}
            options={SECTIONS.map((s) => ({ value: s, label: s }))}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Part</FieldLabel>
          <SegmentedControl
            value={part}
            onChange={setPart}
            options={PARTS_BY_SECTION[section].map((p) => ({ value: p, label: p }))}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Role</FieldLabel>
          <SegmentedControl
            value={role}
            onChange={setRole}
            options={[
              { value: 'member', label: 'Member' },
              { value: 'leader', label: 'Leader' },
            ]}
          />
        </div>
        {member.isSuperAdmin && (
          <p className="-mt-2 text-xs text-ink-faint">Heads up: this is the super-admin account.</p>
        )}
        {error && <p className="text-sm font-semibold text-bad-ink">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Modal>
  );
}
