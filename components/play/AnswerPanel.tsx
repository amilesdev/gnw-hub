'use client';

import { cn } from '@/lib/utils';
import { Check, X } from '@/components/shared/Icons';
import type { QuestionType } from '@/lib/play/types';

// Option colours read from the shared --play-* tokens (not hex literals), so a
// token edit can't leave the buttons behind.
const OPTION_TOKENS = ['--play-pink', '--play-blue', '--play-orange', '--play-green'];
export const optionColor = (i: number, alpha?: number) =>
  `rgb(var(${OPTION_TOKENS[i % 4]})${alpha === undefined ? '' : ` / ${alpha}`})`;

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * One answer, as a lit surface.
 *
 * The reveal is staged as a lighting cue rather than a colour swap: losing
 * panels have the light taken off them (they shrink and fall back to a 22% tint
 * of their own colour) while the correct one takes a hard hit of light — a
 * bloom around it and a single specular sweep across its face. That gesture is
 * the same visual idea as the Enter gate's bloom, so the game reads as one
 * world.
 *
 * Contrast is unchanged from the audited baseline: --play-ink on a solid option
 * colour is 6.2:1–9.0:1, and the dimmed tint over the stage ground measures
 * ≥12:1 for stage ink. Correctness is never carried by colour alone — the right
 * answer takes a check glyph and the light, a wrong pick of yours takes an X.
 */
export function AnswerPanel({
  option,
  index,
  type,
  state,
  disabled,
  onSelect,
  enterDelay = 0,
}: {
  option: string;
  index: number;
  type: QuestionType;
  /** live: still answering · chosen: your locked pick · dimmed: another option
   *  once you've locked · correct/missed/wrong: reveal states */
  state: 'live' | 'chosen' | 'dimmed' | 'correct' | 'missed' | 'wrong';
  disabled?: boolean;
  onSelect?: () => void;
  enterDelay?: number;
}) {
  const isReveal = state === 'correct' || state === 'missed' || state === 'wrong';
  const lit = state === 'correct';

  const face = (
    <>
      {/* No cone. A wedge of light drawn over the winning panel sat between the
          player and the words and read as a stray triangle; the bloom around
          the panel and the sweep below carry the reveal on their own. */}
      {/* One specular streak across its face. */}
      {lit && (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <span className="play-beam-sweep absolute inset-y-0 -left-1/3 w-1/3" />
        </span>
      )}

      {type === 'multiple_choice' && (
        <span
          className={cn(
            'relative grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black',
            isReveal && !lit ? 'bg-white/10 stage-soft' : 'bg-play-ink/20 text-play-ink',
          )}
          aria-hidden
        >
          {LETTERS[index]}
        </span>
      )}

      {/* break-words, not just min-w-0: a single unbreakable answer
          ("Nebuchadnezzar") can't wrap, so on a 375px screen it spills out of
          the panel and collides with the result glyph. */}
      <span className="relative min-w-0 flex-1 break-words text-left leading-tight">{option}</span>

      {(state === 'correct' || state === 'chosen') && (
        <Check width={22} height={22} strokeWidth={3.2} className="relative shrink-0" />
      )}
      {state === 'missed' && (
        <X
          width={22}
          height={22}
          strokeWidth={3.2}
          className="relative shrink-0"
          style={{ color: 'rgb(var(--play-pink))' }}
        />
      )}
    </>
  );

  const shared = cn(
    'relative flex min-h-[5.25rem] items-center gap-3 overflow-visible rounded-2xl p-4',
    'font-display text-lg font-bold',
  );

  // Reveal is a read-only tableau — no longer a button, so a stray tap after
  // the round closes can't feel like a rejected input.
  if (isReveal) {
    return (
      <div
        className={cn(
          shared,
          lit
            ? 'play-beam-hit z-10 text-play-ink'
            : state === 'missed'
              ? 'play-miss stage-ink'
              : 'play-panel-dim stage-ink',
        )}
        style={{
          backgroundColor: optionColor(index, lit ? undefined : 0.22),
          ...(state === 'missed'
            ? { boxShadow: 'inset 0 0 0 2px rgb(var(--play-pink) / 0.8)' }
            : null),
        }}
      >
        {face}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={state === 'chosen'}
      className={cn(
        shared,
        'play-panel-in play-press text-play-ink shadow-pop transition-[opacity,filter,box-shadow]',
        state === 'dimmed' && 'opacity-55 saturate-50',
        // The chosen panel doesn't just get a ring — it stays lit while the
        // others go quiet, which is the same language the reveal uses.
        state === 'chosen' && 'ring-4 ring-play-ink/70',
      )}
      style={{
        backgroundColor: optionColor(index),
        animationDelay: `${enterDelay}ms`,
        ...(state === 'chosen'
          ? { boxShadow: `0 0 0 6px ${optionColor(index, 0.28)}, 0 18px 40px -14px ${optionColor(index, 0.7)}` }
          : null),
      }}
    >
      {face}
    </button>
  );
}
