'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PollDTO, PollResultsDTO } from '@/lib/serialize';
import { apiFetch } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { PollResults } from './PollResults';
import { Check } from './Icons';

const POLL_INTERVAL_MS = 20_000;
// While a voter is looking at their results, refresh the tallies on this
// cadence so they watch answers come in live (matches the leader's view).
const RESULTS_INTERVAL_MS = 5_000;

/**
 * App-wide blocking poll prompt. Mounted inside the authenticated shell, it
 * polls for open polls the user hasn't answered and, when one exists, throws up
 * a non-dismissible overlay that locks the rest of the app until they vote.
 * After voting the same overlay shows the live results (public results); only
 * then does a "Done" button release the app. Multiple pending polls queue up.
 */
export function PollGate() {
  const [polls, setPolls] = useState<PollDTO[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<PollResultsDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // While results are showing we pause polling so the current poll isn't
  // swapped out from under the user before they tap "Done".
  const pausedRef = useRef(false);
  pausedRef.current = results !== null;

  const current = polls[0] ?? null;

  const fetchActive = useCallback(async () => {
    try {
      const data = await apiFetch<{ polls: PollDTO[] }>('/api/polls/active');
      setPolls(data.polls);
    } catch {
      // Unauthenticated, offline, or transient — try again next tick.
    }
  }, []);

  useEffect(() => {
    fetchActive();
    const onFocus = () => {
      if (!pausedRef.current) fetchActive();
    };
    window.addEventListener('focus', onFocus);
    const timer = setInterval(() => {
      if (!pausedRef.current) fetchActive();
    }, POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(timer);
    };
  }, [fetchActive]);

  // Reset the selection whenever a different poll comes to the front.
  useEffect(() => {
    setSelected([]);
    setError(null);
  }, [current?.id]);

  // Once voted, keep the results panel live until the poll ends or "Done".
  const shownId = results?.id ?? null;
  const shownEnded = results?.ended ?? false;
  useEffect(() => {
    if (!shownId || shownEnded) return;
    const t = setInterval(async () => {
      try {
        const data = await apiFetch<{ results: PollResultsDTO }>(`/api/polls/${shownId}`);
        setResults(data.results);
      } catch {
        // transient/offline — try again next tick.
      }
    }, RESULTS_INTERVAL_MS);
    return () => clearInterval(t);
  }, [shownId, shownEnded]);

  // Lock background scroll while the gate is up.
  useEffect(() => {
    if (!current) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [current]);

  if (!current) return null;

  function toggle(choiceId: string) {
    if (!current) return;
    setError(null);
    if (current.multiple) {
      setSelected((s) => (s.includes(choiceId) ? s.filter((c) => c !== choiceId) : [...s, choiceId]));
    } else {
      setSelected([choiceId]);
    }
  }

  async function vote() {
    if (!current) return;
    if (selected.length === 0) return setError('Pick an option to continue.');
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ results: PollResultsDTO }>(`/api/polls/${current.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ choiceIds: selected }),
      });
      haptics.tap();
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your vote.');
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    const doneId = results?.id;
    setResults(null);
    setSelected([]);
    setPolls((ps) => ps.filter((p) => p.id !== doneId));
    fetchActive(); // surface the next queued poll (or anything new)
  }

  return (
    // Non-dismissible: no backdrop-click / Escape handlers, opaque scrim.
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" aria-hidden />
      <div
        className="card relative z-10 flex max-h-[88%] w-full max-w-[400px] flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Team poll"
      >
        <div className="border-b border-line px-5 py-4">
          <div className="eyebrow">{results ? 'Poll results' : 'Team poll'}</div>
          <h2 className="mt-1 font-display text-xl font-semibold leading-snug">{current.question}</h2>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {results ? (
            <PollResults results={results} />
          ) : (
            <div className="space-y-2.5">
              {current.multiple && (
                <p className="text-xs text-ink-faint">Select all that apply.</p>
              )}
              {current.choices.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={`row-press flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left font-semibold ${
                      on ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-surface text-ink'
                    }`}
                  >
                    <span className="min-w-0 truncate">{c.text}</span>
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                        on ? 'border-accent bg-accent text-white' : 'border-line'
                      } ${current.multiple ? 'rounded-md' : 'rounded-full'}`}
                    >
                      {on && <Check width={14} height={14} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {error && <p className="mt-3 text-sm font-semibold text-bad">{error}</p>}
        </div>

        <div className="border-t border-line px-5 py-4">
          {results ? (
            <button type="button" className="btn-primary w-full" onClick={dismiss}>
              Done
            </button>
          ) : (
            <button type="button" className="btn-primary w-full" onClick={vote} disabled={busy}>
              {busy ? 'Submitting…' : 'Vote'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
