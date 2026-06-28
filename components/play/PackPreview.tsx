'use client';

import { cn } from '@/lib/utils';
import { X } from '@/components/shared/Icons';
import type { DraftQuestion } from './QuestionRow';

const LETTERS = ['A', 'B', 'C', 'D'];

// Full-screen, read-only host preview. Correct answers are visible — this is a
// host-only tool (spec §2.8).
export function PackPreview({
  name,
  questions,
  onClose,
}: {
  name: string;
  questions: DraftQuestion[];
  onClose: () => void;
}) {
  return (
    <div className="play-surface absolute inset-0 z-50 flex flex-col animate-fade-in">
      <header
        className="flex items-center justify-between px-4 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)' }}
      >
        <h2 className="truncate font-display text-xl font-semibold">{name}</h2>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft"
          aria-label="Close preview"
        >
          <X width={18} height={18} />
        </button>
      </header>

      <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {questions.map((q, i) => (
          <div key={q.id} className="card p-4">
            <div className="mb-3 flex items-start gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-ink-soft">
                {i + 1}
              </span>
              <p className="text-[15px] font-medium text-ink">
                {q.questionText.trim() || <span className="text-ink-faint">Untitled question</span>}
              </p>
            </div>
            <div className="space-y-2 pl-8">
              {q.options.map((opt, oi) => {
                const correct = opt !== '' && opt === q.correctAnswer;
                return (
                  <div
                    key={oi}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                      correct ? 'border-accent bg-accent-soft font-semibold text-accent-ink' : 'border-line text-ink-soft',
                    )}
                  >
                    <span className="font-bold">{q.type === 'true_false' ? '' : LETTERS[oi]}</span>
                    <span>{opt || <span className="text-ink-faint">—</span>}</span>
                    {correct && <span className="ml-auto text-xs font-bold uppercase">Correct</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
