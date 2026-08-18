'use client';

import { useMemo, useState } from 'react';
import type { LeadDTO } from '@/lib/setlist-serialize';
import type { MemberRow } from './MembersManager';
import { Overlay } from '@/components/shared/Overlay';
import { Avatar } from '@/components/shared/Avatar';
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
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((lead) => (
          <span
            key={lead.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent/10 py-1 pl-1 pr-2 text-xs font-semibold"
          >
            <Avatar
              image={lead.image}
              alt=""
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-ink text-[10px] font-bold text-white"
            >
              {lead.name.charAt(0).toUpperCase()}
            </Avatar>
            <span className="max-w-24 truncate">{lead.name}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((l) => l.id !== lead.id))}
              className="row-press -mr-0.5 rounded-full p-0.5 text-ink-faint"
              aria-label={`Remove ${lead.name} as lead`}
            >
              <X width={12} height={12} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="row-press inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-soft"
        >
          <Mic width={13} height={13} />
          {value.length === 0 ? 'Add lead' : 'Change'}
        </button>
      </div>

      {open && (
        <Overlay
          title="Song lead"
          onClose={() => setOpen(false)}
          action={
            <button type="button" className="btn-primary !px-4 !py-2.5" onClick={() => setOpen(false)}>
              Done
            </button>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-ink-faint">
              Tap to set who leads this song. Pick more than one if they share it.
            </p>

            {options.length === 0 ? (
              <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-faint">
                No active vocalists yet — invite some members first.
              </p>
            ) : (
              <div className="card overflow-hidden">
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
                      className="row-press flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0"
                    >
                      <span
                        className={cn(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-md',
                          on ? 'bg-accent text-white' : 'border border-line',
                        )}
                      >
                        {on && <Check width={14} height={14} />}
                      </span>
                      <Avatar
                        image={c.image}
                        alt=""
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-ink font-semibold text-white"
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {value.length > 0 && (
              <button type="button" className="btn-ghost w-full !text-bad" onClick={() => onChange([])}>
                Clear leads
              </button>
            )}
          </div>
        </Overlay>
      )}
    </>
  );
}
