'use client';

import { useMemo, useState } from 'react';
import type { LeadDTO } from '@/lib/setlist-serialize';
import type { MemberRow } from './MembersManager';
import { Overlay } from '@/components/shared/Overlay';
import { MemberAvatar } from '@/components/shared/Avatar';
import { listCard } from '@/lib/ui-classes';
import { Mic, Check, X } from '@/components/shared/Icons';
import { cn } from '@/lib/utils';

/**
 * Who can be picked to lead: active vocalists. A member with no section set yet
 * counts — they're mid-onboarding, not excluded. Computed once per form, since
 * it's the same list for every song.
 */
export function leadCandidates(members: MemberRow[]): LeadDTO[] {
  return members
    .filter((m) => m.status === 'active' && m.section !== 'Band')
    .map((m) => ({ id: m.id, name: m.name, image: m.image }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The song-leader control on one setlist song row: the people currently set to
 * lead, plus a sheet to change them. Several can be picked — leads sometimes
 * share a song.
 *
 * `candidates` is passed in rather than fetched here so the whole form loads the
 * member list once, not once per song.
 */
export function SongLeadPicker({
  value,
  candidates,
  onChange,
}: {
  value: LeadDTO[];
  candidates: LeadDTO[];
  onChange: (next: LeadDTO[]) => void;
}) {
  const [open, setOpen] = useState(false);

  // Anyone already leading this song stays listed even if they've since left the
  // vocal section, so they're visible and removable rather than silently gone.
  const options = useMemo(() => {
    const known = new Set(candidates.map((c) => c.id));
    const extra = value.filter((l) => !known.has(l.id));
    if (extra.length === 0) return candidates;
    return [...candidates, ...extra].sort((a, b) => a.name.localeCompare(b.name));
  }, [candidates, value]);

  return (
    <>
      {/* Chips are sized to sit level with the Add/Change button beside them. */}
      <div className="flex flex-wrap items-center gap-2">
        {value.map((lead) => (
          <span
            key={lead.id}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-accent-soft pl-1.5 text-sm font-semibold text-accent-ink"
          >
            <MemberAvatar name={lead.name} image={lead.image} size={24} />
            <span className="max-w-28 truncate">{lead.name}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((l) => l.id !== lead.id))}
              // 44px hit area around the small X.
              className="relative grid h-9 w-8 place-items-center rounded-full text-accent-ink/70 after:absolute after:-inset-1 after:content-['']"
              aria-label={`Remove ${lead.name} as lead`}
            >
              <X width={14} height={14} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-outline btn-sm rounded-full text-ink-soft"
        >
          <Mic width={16} height={16} />
          {value.length === 0 ? 'Add lead' : 'Change'}
        </button>
      </div>

      {open && (
        <Overlay
          title="Song lead"
          onClose={() => setOpen(false)}
          action={
            <button type="button" className="btn-primary btn-sm h-11" onClick={() => setOpen(false)}>
              Done
            </button>
          }
        >
          <div className="space-y-4">
            <p className="text-[13px] leading-[18px] text-ink-faint">
              Tap to set who leads this song. Pick more than one if they share it.
            </p>

            {options.length === 0 ? (
              <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-faint">
                No active vocalists yet. Invite some members first.
              </p>
            ) : (
              <div className={listCard}>
                {options.map((c) => {
                  const on = value.some((l) => l.id === c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        onChange(on ? value.filter((l) => l.id !== c.id) : [...value, c])
                      }
                      className="row-press flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span
                        className={cn(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-md',
                          on ? 'bg-accent text-accent-fg' : 'border border-line',
                        )}
                      >
                        {on && <Check width={14} height={14} />}
                      </span>
                      <MemberAvatar name={c.name} image={c.image} size={36} />
                      <span className="row-title min-w-0 flex-1 truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {value.length > 0 && (
              <button type="button" className="btn-danger-text w-full" onClick={() => onChange([])}>
                Clear leads
              </button>
            )}
          </div>
        </Overlay>
      )}
    </>
  );
}
