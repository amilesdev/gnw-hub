'use client';

import type { PollResultsDTO } from '@/lib/serialize';
import { Check } from './Icons';
import { cn } from '@/lib/utils';

/**
 * One poll choice (HM-C5), shared by the Home poll card and the poll gate so
 * they can't drift: a circle indicator for single-choice polls, a rounded
 * square for multi-choice ones.
 */
export function ChoiceButton({
  text,
  on,
  multiple,
  onClick,
}: {
  text: string;
  on: boolean;
  multiple: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl px-4 text-left text-base font-semibold text-ink transition duration-150 active:scale-[0.985]',
        on ? 'border-[1.5px] border-accent bg-accent/10' : 'border border-line bg-surface',
      )}
    >
      <span className="min-w-0 truncate">{text}</span>
      <span
        className={cn(
          'grid h-[22px] w-[22px] shrink-0 place-items-center border',
          multiple ? 'rounded-md' : 'rounded-full',
          on ? 'border-accent bg-accent text-accent-fg' : 'border-line',
        )}
      >
        {on && <Check width={13} height={13} strokeWidth={2.5} />}
      </span>
    </button>
  );
}

/**
 * Read-only results view for a poll: each choice as a labelled bar with its
 * tally, the viewer's own pick(s) marked. Reused by the poll gate (right after
 * voting) and the leader review sheet.
 */
export function PollResults({ results }: { results: PollResultsDTO }) {
  const { choices, totalVoters, myChoiceIds, voters } = results;
  const denom = totalVoters || 1; // avoid divide-by-zero; bars read as 0%

  // Leader-only: names of who picked each choice, keyed by choiceId. Undefined
  // for members, so the per-choice voter list simply doesn't render for them.
  const namesByChoice = voters
    ? voters.reduce<Record<string, string[]>>((acc, v) => {
        for (const cid of v.choiceIds) (acc[cid] ??= []).push(v.name);
        return acc;
      }, {})
    : null;

  return (
    <div className="space-y-2.5">
      {choices.map((c) => {
        const pct = Math.round((c.votes / denom) * 100);
        const mine = myChoiceIds.includes(c.id);
        const names = namesByChoice?.[c.id];
        return (
          <div
            key={c.id}
            className={cn('relative overflow-hidden rounded-2xl border px-4 py-3', mine ? 'border-accent' : 'border-line')}
          >
            <div className="absolute inset-y-0 left-0 bg-accent/[0.12]" style={{ width: `${pct}%` }} aria-hidden />
            <div className="relative flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
                {mine && <Check width={16} height={16} className="shrink-0 text-accent-ink" />}
                <span className="truncate">{c.text}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-ink-soft">
                {pct}% · {c.votes}
              </span>
            </div>
            {namesByChoice && (
              <p className="relative mt-1.5 text-[13px] leading-[18px] text-ink-faint">
                {names && names.length > 0 ? names.join(', ') : 'No votes yet'}
              </p>
            )}
          </div>
        );
      })}
      <p className="pt-1 text-center text-[13px] text-ink-faint">
        {totalVoters} {totalVoters === 1 ? 'person has' : 'people have'} voted
      </p>
    </div>
  );
}
