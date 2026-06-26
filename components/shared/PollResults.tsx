'use client';

import type { PollResultsDTO } from '@/lib/serialize';
import { Check } from './Icons';

/**
 * Read-only results view for a poll: each choice as a labelled bar with its
 * tally, the viewer's own pick(s) marked. Reused by the poll gate (right after
 * voting) and the leader review sheet.
 */
export function PollResults({ results }: { results: PollResultsDTO }) {
  const { choices, totalVoters, myChoiceIds } = results;
  const denom = totalVoters || 1; // avoid divide-by-zero; bars read as 0%

  return (
    <div className="space-y-2.5">
      {choices.map((c) => {
        const pct = Math.round((c.votes / denom) * 100);
        const mine = myChoiceIds.includes(c.id);
        return (
          <div
            key={c.id}
            className={`relative overflow-hidden rounded-2xl border px-4 py-3 ${
              mine ? 'border-accent' : 'border-line'
            }`}
          >
            <div
              className="absolute inset-y-0 left-0 bg-accent/10"
              style={{ width: `${pct}%` }}
              aria-hidden
            />
            <div className="relative flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                {mine && <Check width={16} height={16} className="shrink-0 text-accent" />}
                <span className="truncate">{c.text}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-ink-soft">
                {pct}% · {c.votes}
              </span>
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-center text-xs text-ink-faint">
        {totalVoters} {totalVoters === 1 ? 'person has' : 'people have'} voted
      </p>
    </div>
  );
}
