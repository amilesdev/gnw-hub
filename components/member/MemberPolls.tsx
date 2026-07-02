'use client';

import { useEffect, useState } from 'react';
import type { PollResultsDTO } from '@/lib/serialize';
import { apiFetch } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { PollResults } from '@/components/shared/PollResults';
import { Skeleton, SkeletonList } from '@/components/shared/Skeleton';
import { ChevronDown, ChevronRight, Check, Pencil } from '@/components/shared/Icons';

function formatEnds(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Member's Polls surface: mirrors the leader's list, but read-only on tallies
 *  and — for polls still open — lets the member reopen and change the answer
 *  they gave at the gate. Ended polls show final results, locked. */
export function MemberPolls() {
  const [polls, setPolls] = useState<PollResultsDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const data = await apiFetch<{ polls: PollResultsDTO[] }>('/api/polls/mine');
      setPolls(data.polls);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Keep tallies fresh while watching an open poll's results, so answers come in
  // live (matches the leader/gate cadence). Pause while editing a vote.
  const openPoll = polls.find((p) => p.id === openId);
  const watching = !!openPoll && !openPoll.ended && editId === null;
  useEffect(() => {
    if (!watching) return;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [watching]);

  function startEdit(p: PollResultsDTO) {
    setEditId(p.id);
    setSelected(p.myChoiceIds);
    setError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setSelected([]);
    setError(null);
  }

  function toggle(p: PollResultsDTO, choiceId: string) {
    setError(null);
    if (p.multiple) {
      setSelected((s) => (s.includes(choiceId) ? s.filter((c) => c !== choiceId) : [...s, choiceId]));
    } else {
      setSelected([choiceId]);
    }
  }

  async function save(p: PollResultsDTO) {
    if (selected.length === 0) return setError('Pick an option to continue.');
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/polls/${p.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ choiceIds: selected }),
      });
      haptics.tap();
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your vote.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 pb-2">
      <h2 className="eyebrow">Polls</h2>

      {!loaded ? (
        <SkeletonList>
          <Skeleton className="h-[3.75rem] w-full rounded-3xl" />
          <Skeleton className="h-[3.75rem] w-full rounded-3xl" />
        </SkeletonList>
      ) : polls.length === 0 ? (
        <div className="card p-5 text-center text-sm text-ink-faint">No polls right now — check back when your team posts one.</div>
      ) : (
        polls.map((p) => {
          const open = openId === p.id;
          const editing = editId === p.id;
          return (
            <div key={p.id} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (open) cancelEdit();
                  setOpenId(open ? null : p.id);
                }}
                className="row-press flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.question}</span>
                  <span className="block text-xs text-ink-faint">
                    {p.ended ? 'Ended' : 'Active'} · {formatEnds(p.endsAt)} · {p.totalVoters} voted
                  </span>
                </span>
                <span className={`chip ${p.ended ? 'bg-surface-2 text-ink-faint' : 'bg-accent/15 text-accent-ink dark:text-accent-on'}`}>
                  {p.ended ? 'Ended' : 'Live'}
                </span>
                {open ? (
                  <ChevronDown width={18} height={18} className="text-ink-faint" />
                ) : (
                  <ChevronRight width={18} height={18} className="text-ink-faint" />
                )}
              </button>

              {open && (
                <div className="space-y-3 border-t border-line px-4 py-4">
                  {editing ? (
                    <>
                      {p.multiple && <p className="text-xs text-ink-faint">Select all that apply.</p>}
                      <div className="space-y-2.5">
                        {p.choices.map((c) => {
                          const on = selected.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggle(p, c.id)}
                              className={`row-press flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left font-semibold ${
                                on ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-surface text-ink'
                              }`}
                            >
                              <span className="min-w-0 truncate">{c.text}</span>
                              <span
                                className={`grid h-6 w-6 shrink-0 place-items-center border ${
                                  on ? 'border-accent bg-accent text-white' : 'border-line'
                                } ${p.multiple ? 'rounded-md' : 'rounded-full'}`}
                              >
                                {on && <Check width={14} height={14} />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {error && <p className="text-sm font-semibold text-bad">{error}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={cancelEdit} className="btn-ghost flex-1 !py-2 text-sm">
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => save(p)}
                          disabled={busy}
                          className="btn-primary flex-1 !py-2 text-sm"
                        >
                          {busy ? 'Saving…' : 'Save vote'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <PollResults results={p} />
                      {!p.ended && (
                        <button type="button" onClick={() => startEdit(p)} className="btn-ghost w-full !py-2 text-sm">
                          <Pencil width={16} height={16} /> Change my vote
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
