'use client';

import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TextField, FieldLabel } from '@/components/shared/Field';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Plus, Pencil, Trash, Repeat, Check } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
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
  isSuperAdmin: boolean;
  inviteExpiry: string | null;
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
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const { members } = await apiFetch<{ members: MemberRow[] }>('/api/members');
    setMembers(members);
  }

  async function reinvite(m: MemberRow) {
    setBusyId(m.id);
    try {
      const res = await apiFetch<{ emailSkipped: boolean }>(`/api/members/${m.id}/reinvite`, { method: 'POST' });
      setNotice(res.emailSkipped ? 'Invite regenerated (email not configured — check server logs for the link).' : `Re-invite sent to ${m.email}.`);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not re-invite.');
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
      setNotice(e instanceof Error ? e.message : 'Could not revoke.');
    } finally {
      setBusyId(null);
    }
  }

  const pending = members.filter((m) => m.status === 'pending');
  const active = members.filter((m) => m.status === 'active');

  return (
    <div className="space-y-5 pt-2">
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Leader tools</div>
          <h1 className="page-title mt-2">Members</h1>
        </div>
        <button type="button" className="btn-primary !px-4 !py-3" onClick={() => setInviteOpen(true)}>
          <Plus width={18} height={18} /> Invite
        </button>
      </header>

      {notice && (
        <div className="card flex items-start gap-2 bg-accent/5 p-4 text-sm text-accent-ink">
          <Check width={16} height={16} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
          <button className="ml-auto text-ink-faint" onClick={() => setNotice(null)} type="button">
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
                      <span className="chip bg-surface-2 text-ink-soft capitalize">{m.role}</span>
                      <span className={expired ? 'chip bg-bad/15 text-bad' : 'chip bg-warn/15 text-[#8F5E1C]'}>
                        {expired ? 'Expired' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-ghost !py-2 text-sm" onClick={() => setEditing(m)} type="button">
                    <Pencil width={15} height={15} /> Edit
                  </button>
                  <button
                    className="btn-ghost !py-2 text-sm"
                    onClick={() => reinvite(m)}
                    disabled={busyId === m.id}
                    type="button"
                  >
                    <Repeat width={15} height={15} /> {expired ? 'Re-invite' : 'Resend'}
                  </button>
                  <button
                    className="btn-ghost !py-2 text-sm text-bad"
                    onClick={() => setConfirming(m)}
                    type="button"
                  >
                    <Trash width={15} height={15} /> Revoke
                  </button>
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
                  <span className="chip bg-accent/10 text-accent-ink capitalize">{m.role}</span>
                </div>
              </div>
              <button className="btn-ghost !py-2 text-sm" onClick={() => setEditing(m)} type="button">
                <Pencil width={15} height={15} /> Edit
              </button>
            </div>
          </div>
        ))}
        {active.length === 0 && <p className="text-sm text-ink-faint">No active members yet.</p>}
      </section>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onDone={async (msg) => {
          setInviteOpen(false);
          setNotice(msg);
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
        title="Revoke invite?"
        message={`This removes ${confirming?.name ?? 'this person'}’s pending invite. They won’t be able to claim it.`}
        confirmLabel="Revoke"
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
  onDone: (msg: string) => void;
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
      const res = await apiFetch<{ emailSkipped: boolean }>('/api/members', {
        method: 'POST',
        body: JSON.stringify({ name, email, section, part, role }),
      });
      onDone(res.emailSkipped ? `Invite created for ${email} (email not configured — link is in server logs).` : `Invite sent to ${email}.`);
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
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        <TextField
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="them@email.com"
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
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
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
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
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
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Modal>
  );
}
