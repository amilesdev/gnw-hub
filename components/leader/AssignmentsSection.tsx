'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MemberRow } from './MembersManager';
import type { EventAssignmentDTO } from '@/lib/serialize';
import { Mic, ChevronDown, Check } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export const VOCAL_PARTS = ['Soprano', 'Alto', 'Tenor'] as const;
export type VocalPart = (typeof VOCAL_PARTS)[number];

/** Who sings what: userId → part. One part per person, so a plain map does it. */
export type AssignmentMap = Record<string, VocalPart>;

export function toAssignmentMap(assignments: EventAssignmentDTO[] | undefined): AssignmentMap {
  const map: AssignmentMap = {};
  for (const a of assignments ?? []) map[a.userId] = a.part;
  return map;
}

type Candidate = { id: string; name: string; part: VocalPart | null };

/**
 * Singing assignments for a Service event (leader-only, in the event form).
 * One carousel per part, listing the team's vocalists — the ones whose saved
 * part matches the carousel come first, but any vocalist can cover any part for
 * a given Sunday. Picking someone in a second part is blocked (you can't sing
 * two at once); deselect them first.
 */
export function AssignmentsSection({
  value,
  onChange,
  initialAssignments,
}: {
  value: AssignmentMap;
  onChange: (next: AssignmentMap) => void;
  initialAssignments?: EventAssignmentDTO[];
}) {
  const count = Object.keys(value).length;
  const [open, setOpen] = useState(count > 0);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ members: MemberRow[] }>('/api/members')
      .then(({ members }) => {
        if (active) setMembers(members);
      })
      .catch(() => {
        if (active) setError('Could not load the member list.');
      });
    return () => {
      active = false;
    };
  }, []);

  // The pickable roster: active vocalists, plus anyone already assigned to this
  // event who has since left the vocal section (so they stay visible/removable).
  const candidates = useMemo<Candidate[]>(() => {
    const rows: Candidate[] = (members ?? [])
      .filter((m) => m.status === 'active' && m.section === 'Vocalist')
      .map((m) => ({
        id: m.id,
        name: m.name,
        part: (VOCAL_PARTS as readonly string[]).includes(m.part ?? '') ? (m.part as VocalPart) : null,
      }));

    const known = new Set(rows.map((r) => r.id));
    for (const a of initialAssignments ?? []) {
      if (!known.has(a.userId)) rows.push({ id: a.userId, name: a.name, part: null });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [members, initialAssignments]);

  function toggle(userId: string, part: VocalPart) {
    const next = { ...value };
    if (next[userId] === part) delete next[userId];
    else next[userId] = part;
    onChange(next);
  }

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="row-press flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="inline-flex items-center gap-2 font-semibold">
          <Mic width={18} height={18} className="text-accent dark:text-accent-on" /> Assignments (optional)
        </span>
        <span className="flex items-center gap-2">
          {count > 0 && (
            <span className="text-xs font-semibold text-accent-ink dark:text-accent-on">
              {count} assigned
            </span>
          )}
          <ChevronDown width={20} height={20} className={cn('text-ink-faint transition', open && 'rotate-180')} />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-line px-4 py-4">
          <p className="text-xs text-ink-faint">
            Tap a name to put them on a part — swipe to see more. Someone can only hold one part per
            service.
          </p>

          {error && <p className="text-sm font-semibold text-bad">{error}</p>}
          {!members && !error && <p className="text-sm text-ink-faint">Loading members…</p>}
          {members && candidates.length === 0 && (
            <p className="text-sm text-ink-faint">No active vocalists yet — invite some members first.</p>
          )}

          {candidates.length > 0 &&
            VOCAL_PARTS.map((part) => {
              // Vocalists saved to this part lead the carousel; the rest follow.
              const ordered = [...candidates].sort(
                (a, b) => Number(b.part === part) - Number(a.part === part),
              );
              const picked = candidates.filter((c) => value[c.id] === part);
              return (
                <div key={part}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="eyebrow">{part}</p>
                    <span className="text-xs text-ink-faint">
                      {picked.length > 0 ? picked.map((p) => p.name).join(', ') : 'None yet'}
                    </span>
                  </div>
                  <div className="no-scrollbar -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1">
                    {ordered.map((c) => {
                      const on = value[c.id] === part;
                      const elsewhere = value[c.id] && !on ? value[c.id] : null;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggle(c.id, part)}
                          disabled={Boolean(elsewhere)}
                          aria-pressed={on}
                          className={cn(
                            'row-press relative flex w-32 shrink-0 snap-start flex-col justify-between rounded-2xl border px-3.5 py-3 text-left transition',
                            on ? 'border-accent bg-accent/10 shadow-pop' : 'border-line bg-surface',
                            elsewhere && 'opacity-40',
                          )}
                        >
                          <span
                            className={cn(
                              'grid h-5 w-5 place-items-center rounded-md',
                              on ? 'bg-accent text-white' : 'border border-line',
                            )}
                          >
                            {on && <Check width={13} height={13} />}
                          </span>
                          <span className="mt-2 block truncate text-sm font-semibold">{c.name}</span>
                          <span className="truncate text-xs text-ink-faint">
                            {elsewhere ? `On ${elsewhere.toLowerCase()}` : c.part ?? 'Vocalist'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
