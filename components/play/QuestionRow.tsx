'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Grip, Trash, ChevronDown, Check } from '@/components/shared/Icons';
import type { SerializedQuestion } from '@/lib/play/packs';

export type DraftQuestion = SerializedQuestion;

const LETTERS = ['A', 'B', 'C', 'D'];

export function isIncomplete(q: DraftQuestion): boolean {
  return q.questionText.trim() === '' || !q.options.includes(q.correctAnswer);
}

export function QuestionRow({
  question,
  index,
  expanded,
  locked,
  onToggle,
  onChange,
  onDelete,
}: {
  question: DraftQuestion;
  index: number;
  expanded: boolean;
  locked: boolean;
  onToggle: () => void;
  onChange: (next: DraftQuestion) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    disabled: locked,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const incomplete = isIncomplete(question);

  const setType = (type: DraftQuestion['type']) => {
    if (type === question.type) return;
    onChange({
      ...question,
      type,
      options: type === 'true_false' ? ['True', 'False'] : ['', '', '', ''],
      correctAnswer: '',
    });
  };

  const setOption = (i: number, value: string) => {
    const options = [...question.options];
    const wasCorrect = question.correctAnswer === options[i];
    options[i] = value;
    onChange({ ...question, options, correctAnswer: wasCorrect ? value : question.correctAnswer });
  };

  const setCorrect = (value: string) => onChange({ ...question, correctAnswer: value });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('card overflow-hidden', isDragging && 'opacity-60 shadow-card-lg')}
    >
      {/* Collapsed header — tap to expand/collapse */}
      <div className="flex items-center gap-2 px-3 py-3">
        {!locked && (
          <button
            type="button"
            className="grid h-8 w-7 cursor-grab touch-none place-items-center text-ink-faint active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <Grip width={16} height={16} />
          </button>
        )}
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-bold text-ink-soft">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
            {question.questionText.trim() || <span className="text-ink-faint">Untitled question</span>}
          </span>
          {incomplete && <span className="h-2 w-2 shrink-0 rounded-full bg-warn" title="Incomplete" />}
          <span className="chip shrink-0 bg-surface-2 text-ink-soft">
            {question.type === 'true_false' ? 'T/F' : 'MCQ'}
          </span>
          <ChevronDown
            width={18}
            height={18}
            className={cn('shrink-0 text-ink-faint transition-transform', expanded && 'rotate-180')}
          />
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="animate-rise space-y-4 border-t border-line px-4 pb-5 pt-4">
          {/* Type segmented control */}
          <div className="flex gap-2">
            {(['multiple_choice', 'true_false'] as const).map((t) => (
              <button
                key={t}
                type="button"
                disabled={locked}
                onClick={() => setType(t)}
                className={cn(
                  'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition',
                  question.type === t ? 'bg-accent text-white shadow-pop' : 'bg-surface-2 text-ink-soft',
                )}
              >
                {t === 'true_false' ? 'True / False' : 'Multiple Choice'}
              </button>
            ))}
          </div>

          <textarea
            className="field min-h-[4.5rem] resize-none"
            placeholder={question.type === 'true_false' ? 'Statement…' : 'Question…'}
            value={question.questionText}
            disabled={locked}
            onChange={(e) => onChange({ ...question, questionText: e.target.value })}
            rows={2}
          />

          {/* Options */}
          {question.type === 'multiple_choice' ? (
            <div className="space-y-2">
              {question.options.map((opt, i) => {
                const selected = opt !== '' && question.correctAnswer === opt;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={locked || opt === ''}
                      onClick={() => setCorrect(opt)}
                      aria-label={`Mark ${LETTERS[i]} correct`}
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-sm font-bold transition',
                        selected
                          ? 'border-accent bg-accent text-white'
                          : 'border-line bg-surface-2 text-ink-soft',
                      )}
                    >
                      {selected ? <Check width={16} height={16} /> : LETTERS[i]}
                    </button>
                    <input
                      className="field"
                      placeholder={`Option ${LETTERS[i]}`}
                      value={opt}
                      disabled={locked}
                      onChange={(e) => setOption(i, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex gap-2">
              {['True', 'False'].map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={locked}
                  onClick={() => setCorrect(v)}
                  className={cn(
                    'flex-1 rounded-2xl py-4 text-base font-bold transition',
                    question.correctAnswer === v
                      ? 'bg-accent text-white shadow-pop'
                      : 'bg-surface-2 text-ink-soft',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          {!locked && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-bad"
            >
              <Trash width={15} height={15} /> Delete question
            </button>
          )}
        </div>
      )}
    </div>
  );
}
