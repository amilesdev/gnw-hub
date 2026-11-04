'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { LookStatus } from '@prisma/client';
import type { LookDTO, SeasonAttireDTO } from '@/lib/crossover-attire';
import { Overlay } from '@/components/shared/Overlay';
import { FieldLabel, TextArea } from '@/components/shared/Field';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Avatar } from '@/components/shared/Avatar';
import { AttireColorField } from '@/components/leader/EventForm';
import { Camera, Check, ChevronLeft, Pencil, Shirt, Trash, Upload, X } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { uploadFile } from '@/lib/upload-client';
import { fitImageFile } from '@/lib/image-resize';
import { cn, randomToken } from '@/lib/utils';

type Base = '/home' | '/dashboard';

const STATUS: Record<LookStatus, { label: string; chip: string }> = {
  pending: { label: 'Waiting on review', chip: 'bg-warn/15 text-[#8F5E1C] dark:text-[#E0A75E]' },
  changes_requested: { label: 'Changes requested', chip: 'bg-bad/15 text-bad dark:text-[#D98A84]' },
  approved: { label: 'Approved', chip: 'bg-accent/10 text-accent-ink dark:text-accent-on' },
};

/**
 * Crossover attire: this year's look (colors, notes, reference photos — leaders
 * edit it), your own submitted look and where its review stands, the review
 * queue for the attire reviewer, and the approved looks.
 */
export function CrossoverAttire({
  base,
  year,
  userId,
  initialAttire,
  initialMine,
  initialLooks,
  canManage,
  canReview,
}: {
  base: Base;
  year: number;
  userId: string;
  initialAttire: SeasonAttireDTO;
  initialMine: LookDTO | null;
  initialLooks: LookDTO[];
  canManage: boolean;
  canReview: boolean;
}) {
  const [attire, setAttire] = useState(initialAttire);
  const [mine, setMine] = useState(initialMine);
  const [looks, setLooks] = useState(initialLooks);
  const [editingAttire, setEditingAttire] = useState(false);
  const [editingLook, setEditingLook] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [viewing, setViewing] = useState<LookDTO | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep the shared list in step with the viewer's own look and with reviews.
  function upsertLook(look: LookDTO) {
    setLooks((prev) => [...prev.filter((l) => l.id !== look.id), look]);
    if (look.userId === userId) setMine(look);
  }

  async function withdraw() {
    setBusy(true);
    try {
      await apiFetch('/api/crossover/looks/mine', { method: 'DELETE' });
      setLooks((prev) => prev.filter((l) => l.userId !== userId));
      setMine(null);
      setWithdrawing(false);
    } finally {
      setBusy(false);
    }
  }

  const others = looks.filter((l) => l.userId !== userId);
  const toReview = others.filter((l) => l.status === 'pending');
  const sentBack = others.filter((l) => l.status === 'changes_requested');
  const approved = looks.filter((l) => l.status === 'approved');
  const hasAttire = Boolean(
    attire.attirePrimary || attire.attireSecondary || attire.attireComplement || attire.attireNotes || attire.attirePhotos.length,
  );

  return (
    <div className="space-y-5 pt-2">
      <Link
        href={`${base}/crossover`}
        className="row-press -ml-1 inline-flex items-center gap-0.5 rounded-lg py-1 text-[15px] font-semibold text-accent-ink dark:text-accent-on"
      >
        <ChevronLeft width={18} height={18} /> Crossover
      </Link>

      <header className="flex items-end justify-between gap-2 pr-12">
        <div>
          <div className="eyebrow">Crossover {year}</div>
          <h1 className="page-title mt-2">Attire</h1>
        </div>
        {canManage && (
          <button type="button" className="btn-ghost border border-line !px-4 !py-3" onClick={() => setEditingAttire(true)}>
            <Pencil width={16} height={16} /> Edit
          </button>
        )}
      </header>

      {/* This year's look */}
      <section className="card space-y-4 p-4">
        <p className="eyebrow inline-flex items-center gap-1.5">
          <Shirt width={14} height={14} /> This year&rsquo;s look
        </p>
        {!hasAttire ? (
          <p className="text-sm text-ink-faint">
            {canManage ? 'No attire yet. Tap Edit to set the colors and notes.' : 'The attire for Crossover hasn’t been posted yet.'}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Swatch label="Primary" name={attire.attirePrimary} hex={attire.attirePrimaryHex} />
              <Swatch label="Secondary" name={attire.attireSecondary} hex={attire.attireSecondaryHex} />
              <Swatch label="Tertiary" name={attire.attireComplement} hex={attire.attireComplementHex} />
            </div>
            {attire.attireNotes && <p className="whitespace-pre-wrap text-sm text-ink-soft">{attire.attireNotes}</p>}
            {attire.attirePhotos.length > 0 && <PhotoGrid photos={attire.attirePhotos} />}
          </>
        )}
      </section>

      {/* Your look */}
      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Your look</p>
          {mine && <span className={cn('chip', STATUS[mine.status].chip)}>{STATUS[mine.status].label}</span>}
        </div>
        {!mine ? (
          <p className="text-sm text-ink-soft">Take or upload a photo of your outfit. Judy reviews every look.</p>
        ) : (
          <>
            <PhotoGrid photos={mine.photos} />
            {mine.note && <p className="text-sm text-ink-soft">{mine.note}</p>}
            {mine.reviewNote && (
              <div
                className={cn(
                  'rounded-2xl px-3.5 py-2.5 text-sm',
                  mine.status === 'changes_requested' ? 'bg-bad/10 text-bad dark:text-[#D98A84]' : 'bg-accent-soft text-ink',
                )}
              >
                <strong>{mine.reviewedByName?.split(' ')[0] ?? 'Reviewer'}:</strong> {mine.reviewNote}
              </div>
            )}
          </>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn-primary flex-1" onClick={() => setEditingLook(true)}>
            <Camera width={17} height={17} />
            {!mine ? 'Submit my look' : mine.status === 'changes_requested' ? 'Resubmit' : 'Update my look'}
          </button>
          {mine && (
            <button type="button" className="btn-ghost !px-3.5 text-bad" onClick={() => setWithdrawing(true)} aria-label="Withdraw my look">
              <Trash width={17} height={17} />
            </button>
          )}
        </div>
      </section>

      {/* The reviewer's queue */}
      {canReview && (
        <section className="space-y-3">
          <h2 className="eyebrow">To review · {toReview.length}</h2>
          {toReview.length === 0 ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-4 text-center text-sm text-ink-faint">You&rsquo;re all caught up.</p>
          ) : (
            toReview.map((l) => <ReviewCard key={l.id} look={l} onReviewed={upsertLook} />)
          )}
        </section>
      )}

      {/* Leaders and the reviewer can also see who's been sent back. */}
      {(canReview || canManage) && sentBack.length > 0 && (
        <section className="space-y-2">
          <h2 className="eyebrow">Waiting on changes · {sentBack.length}</h2>
          <div className="card divide-y divide-line">
            {sentBack.map((l) => (
              <button key={l.id} type="button" onClick={() => setViewing(l)} className="row-press flex w-full items-center gap-3 px-4 py-3 text-left">
                <Face name={l.name} image={l.image} size={32} />
                <span className="min-w-0 flex-1 truncate font-semibold">{l.name}</span>
                <span className={cn('chip', STATUS.changes_requested.chip)}>Changes</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {canManage && !canReview && toReview.length > 0 && (
        <p className="text-sm text-ink-soft">
          {toReview.length} look{toReview.length === 1 ? ' is' : 's are'} waiting for Judy&rsquo;s review.
        </p>
      )}

      {/* Approved looks */}
      <section className="space-y-3">
        <h2 className="eyebrow">Approved looks · {approved.length}</h2>
        {approved.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-4 text-center text-sm text-ink-faint">No approved looks yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {approved.map((l) => (
              <button key={l.id} type="button" onClick={() => setViewing(l)} className="row-press text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.photos[0]} alt={`${l.name}'s look`} className="aspect-[3/4] w-full rounded-2xl border border-line object-cover" />
                <span className="mt-1 block truncate text-xs font-semibold">{l.userId === userId ? 'You' : l.name}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {editingAttire && (
        <AttireEditor
          year={year}
          initial={attire}
          onClose={() => setEditingAttire(false)}
          onSaved={(next) => {
            setAttire(next);
            setEditingAttire(false);
          }}
        />
      )}
      {editingLook && (
        <LookEditor
          userId={userId}
          year={year}
          initial={mine}
          onClose={() => setEditingLook(false)}
          onSaved={(look) => {
            upsertLook(look);
            setEditingLook(false);
          }}
        />
      )}
      {viewing && (
        <Overlay title={viewing.userId === userId ? 'Your look' : `${viewing.name}'s look`} onClose={() => setViewing(null)}>
          <div className="space-y-3">
            <span className={cn('chip', STATUS[viewing.status].chip)}>{STATUS[viewing.status].label}</span>
            <PhotoGrid photos={viewing.photos} large />
            {viewing.note && <p className="text-sm text-ink-soft">{viewing.note}</p>}
            {viewing.reviewNote && (
              <p className="text-sm text-ink-soft">
                <strong>{viewing.reviewedByName?.split(' ')[0] ?? 'Reviewer'}:</strong> {viewing.reviewNote}
              </p>
            )}
          </div>
        </Overlay>
      )}
      <ConfirmDialog
        open={withdrawing}
        title="Withdraw your look?"
        message="This removes your photos and its review. You can submit a new one any time."
        confirmLabel="Withdraw"
        busy={busy}
        onConfirm={withdraw}
        onClose={() => setWithdrawing(false)}
      />
    </div>
  );
}

/** A member's photo, or their initial when they haven't set one. */
function Face({ name, image, size }: { name: string; image: string | null; size: number }) {
  return (
    <Avatar
      image={image}
      className="grid shrink-0 place-items-center rounded-full bg-accent-soft font-display font-semibold text-accent-ink dark:text-accent-on"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.charAt(0)}
    </Avatar>
  );
}

function Swatch({ label, name, hex }: { label: string; name: string | null; hex: string | null }) {
  if (!name && !hex) return <span />;
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span
        className="grid h-14 w-14 place-items-center rounded-2xl border border-line text-ink-faint shadow-card"
        style={hex ? { background: hex } : undefined}
        aria-hidden
      >
        {!hex && <Shirt width={18} height={18} />}
      </span>
      <span className="label">{label}</span>
      {name && <span className="text-xs font-semibold text-ink-soft">{name}</span>}
    </div>
  );
}

function PhotoGrid({ photos, large }: { photos: string[]; large?: boolean }) {
  return (
    <div className={cn('grid gap-2', large ? 'grid-cols-2' : 'grid-cols-3')}>
      {photos.map((src) => (
        <a key={src} href={src} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="aspect-[3/4] w-full rounded-2xl border border-line object-cover" />
        </a>
      ))}
    </div>
  );
}

/** One look in the reviewer's queue: photos, the member's note, Approve or ask for changes. */
function ReviewCard({ look, onReviewed }: { look: LookDTO; onReviewed: (look: LookDTO) => void }) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(status: 'approved' | 'changes_requested') {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ look: LookDTO }>(`/api/crossover/looks/${look.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewNote: note.trim() || null }),
      });
      onReviewed(res.look);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the review.');
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-3">
        <Face name={look.name} image={look.image} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{look.name}</span>
          <span className="block text-xs text-ink-faint">
            Submitted {new Date(look.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </span>
      </div>
      <PhotoGrid photos={look.photos} />
      {look.note && <p className="text-sm text-ink-soft">{look.note}</p>}
      {asking && (
        <textarea
          className="field min-h-[44px]"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What should change?"
          maxLength={500}
          autoFocus
        />
      )}
      {error && <p className="text-sm font-semibold text-bad">{error}</p>}
      <div className="flex gap-2">
        {asking ? (
          <>
            <button type="button" className="btn-ghost flex-1" onClick={() => setAsking(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn-primary flex-1" onClick={() => review('changes_requested')} disabled={busy || !note.trim()}>
              {busy ? 'Sending…' : 'Send back'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-ghost flex-1" onClick={() => setAsking(true)} disabled={busy}>
              Ask for changes
            </button>
            <button type="button" className="btn-primary flex-1" onClick={() => review('approved')} disabled={busy}>
              <Check width={17} height={17} /> {busy ? 'Saving…' : 'Approve'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Submit or resubmit your look: up to 6 photos (shrunk before upload) and an optional note. */
function LookEditor({
  userId,
  year,
  initial,
  onClose,
  onSaved,
}: {
  userId: string;
  year: number;
  initial: LookDTO | null;
  onClose: () => void;
  onSaved: (look: LookDTO) => void;
}) {
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [note, setNote] = useState(initial?.note ?? '');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const room = 6 - photos.length;
      for (const file of Array.from(files).slice(0, room)) {
        const small = await fitImageFile(file);
        const url = await uploadFile(`looks/${userId}/crossover-${year}-${Date.now()}-${randomToken(4)}.jpg`, small);
        setPhotos((prev) => [...prev, url]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit() {
    if (!photos.length) {
      setError('Add at least one photo of your look.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ look: LookDTO }>('/api/crossover/looks/mine', {
        method: 'PUT',
        body: JSON.stringify({ photos, note: note.trim() || null }),
      });
      onSaved(res.look);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your look.');
      setBusy(false);
    }
  }

  return (
    <Overlay
      title={initial ? 'Update your look' : 'Submit your look'}
      onClose={onClose}
      action={
        <button type="button" className="btn-primary !px-4 !py-2.5" disabled={busy || uploading} onClick={submit}>
          {busy ? 'Sending…' : 'Submit'}
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>Photos</FieldLabel>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Your look" className="aspect-[3/4] w-full rounded-2xl border border-line object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((u) => u !== url))}
                  className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-bad text-white shadow-card transition active:scale-90"
                  aria-label="Remove photo"
                >
                  <X width={13} height={13} />
                </button>
              </div>
            ))}
            {photos.length < 6 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="row-press grid aspect-[3/4] place-items-center rounded-2xl border-2 border-dashed border-line text-ink-faint"
              >
                <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                  <Camera width={20} height={20} />
                  {uploading ? 'Uploading…' : 'Add photo'}
                </span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          <p className="mt-2 text-xs text-ink-faint">A full-length photo works best. Up to 6.</p>
        </div>
        <TextArea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything Judy should know" />
        {initial && <p className="text-xs text-ink-faint">Resubmitting sends your look back for review.</p>}
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
      </div>
    </Overlay>
  );
}

/** Leaders: set this season's colors, notes and reference photos. */
function AttireEditor({
  year,
  initial,
  onClose,
  onSaved,
}: {
  year: number;
  initial: SeasonAttireDTO;
  onClose: () => void;
  onSaved: (attire: SeasonAttireDTO) => void;
}) {
  const [a, setA] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<SeasonAttireDTO>) => setA((prev) => ({ ...prev, ...patch }));

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadFile(`attire/crossover-${year}/${Date.now()}-${file.name}`, file);
        setA((prev) => ({ ...prev, attirePhotos: [...prev.attirePhotos, url] }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ attire: SeasonAttireDTO }>('/api/crossover/attire', { method: 'PATCH', body: JSON.stringify(a) });
      onSaved(res.attire);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the attire.');
      setBusy(false);
    }
  }

  return (
    <Overlay
      title="Crossover attire"
      onClose={onClose}
      action={
        <button type="button" className="btn-primary !px-4 !py-2.5" disabled={busy || uploading} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <div className="space-y-4">
        <AttireColorField
          label="Primary"
          name={a.attirePrimary ?? ''}
          onName={(v) => set({ attirePrimary: v })}
          hex={a.attirePrimaryHex ?? ''}
          onHex={(v) => set({ attirePrimaryHex: v || null })}
          placeholder="Black"
        />
        <AttireColorField
          label="Secondary"
          name={a.attireSecondary ?? ''}
          onName={(v) => set({ attireSecondary: v })}
          hex={a.attireSecondaryHex ?? ''}
          onHex={(v) => set({ attireSecondaryHex: v || null })}
          placeholder="Gold"
        />
        <AttireColorField
          label="Tertiary"
          name={a.attireComplement ?? ''}
          onName={(v) => set({ attireComplement: v })}
          hex={a.attireComplementHex ?? ''}
          onHex={(v) => set({ attireComplementHex: v || null })}
          placeholder="Ivory"
        />
        <TextArea
          label="Notes"
          value={a.attireNotes ?? ''}
          onChange={(e) => set({ attireNotes: e.target.value })}
          placeholder="Fabrics, shoes, accessories"
        />
        <div>
          <FieldLabel>Reference photos</FieldLabel>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {a.attirePhotos.map((url) => (
              <div key={url} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Attire" className="h-full w-full rounded-2xl border border-line object-cover" />
                <button
                  type="button"
                  onClick={() => set({ attirePhotos: a.attirePhotos.filter((u) => u !== url) })}
                  className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-bad text-white shadow-card transition active:scale-90"
                  aria-label="Remove photo"
                >
                  <Trash width={13} height={13} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="row-press grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-line text-ink-faint"
            >
              <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                <Upload width={20} height={20} />
                {uploading ? 'Uploading…' : 'Add'}
              </span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </div>
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
      </div>
    </Overlay>
  );
}
