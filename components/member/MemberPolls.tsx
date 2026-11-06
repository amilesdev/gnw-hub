'use client';

import { useEffect, useState } from 'react';
import type { PollResultsDTO } from '@/lib/serialize';
import { apiFetch } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { PollResults, ChoiceButton } from '@/components/shared/PollResults';
import { Skeleton, SkeletonList } from '@/components/shared/Skeleton';
import { ChevronRight, Pencil } from '@/components/shared/Icons';

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
      <h2 className="t-title">Polls</h2>

      {!loaded ? (
        <SkeletonList>
          <Skeleton className="h-[3.75rem] w-full rounded-3xl" />
          <Skeleton className="h-[3.75rem] w-full rounded-3xl" />
        </SkeletonList>
      ) : polls.length === 0 ? (
        <div className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-faint">No polls right now. Check back when your team posts one.</div>
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
                className="row-press flex w-full items-center gap-3 py-3.5 pl-4 pr-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="row-title block truncate">{p.question}</span>
                  <span className="block text-[13px] leading-[18px] text-ink-faint">
                    {p.ended ? 'Ended' : 'Active'} · {formatEnds(p.endsAt)} · {p.totalVoters} voted
                  </span>
                </span>
                <span className={`chip ${p.ended ? 'bg-surface-2 text-ink-faint' : 'bg-accent-soft text-accent-ink'}`}>
                  {p.ended ? 'Ended' : 'Live'}
                </span>
                <ChevronRight width={18} height={18} className={`shrink-0 text-ink-faint transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
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
                            <ChoiceButton key={c.id} text={c.text} on={on} multiple={p.multiple} onClick={() => toggle(p, c.id)} />
                          );
                        })}
                      </div>
                      {error && <p className="text-[13px] font-semibold text-bad-ink" role="alert">{error}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={cancelEdit} className="btn-ghost flex-1">
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => save(p)}
                          disabled={busy}
                          className="btn-primary flex-1"
                        >
                          {busy ? 'Saving…' : 'Save vote'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <PollResults results={p} />
                      {!p.ended && (
                        <button type="button" onClick={() => startEdit(p)} className="btn-ghost w-full">
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
