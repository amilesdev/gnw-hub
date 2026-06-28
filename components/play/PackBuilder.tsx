'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Plus, Check, Lock, ChevronLeft } from '@/components/shared/Icons';
import { PlayConfirm } from './PlayModal';
import { QuestionRow, isIncomplete, type DraftQuestion } from './QuestionRow';
import { PackPreview } from './PackPreview';
import { usePlayActive } from '@/lib/play/use-play-active';
import type { SerializedPack } from '@/lib/play/packs';
import { MIN_QUESTIONS_TO_PLAY } from '@/lib/play/validation';

export function PackBuilder({ initialPack }: { initialPack: SerializedPack }) {
  usePlayActive();
  const router = useRouter();
  const locked = initialPack.locked;

  const [name, setName] = useState(initialPack.name);
  const [questions, setQuestions] = useState<DraftQuestion[]>(initialPack.questions);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const base = `/api/play/packs/${initialPack.id}`;

  // --- Autosave ----------------------------------------------------------
  const persistQuestion = async (q: DraftQuestion) => {
    try {
      await apiFetch(`${base}/questions`, { method: 'POST', body: JSON.stringify(q) });
      flashSaved();
    } catch {
      /* transient — next edit retries */
    }
  };

  const changeQuestion = (next: DraftQuestion) => {
    setQuestions((qs) => qs.map((q) => (q.id === next.id ? next : q)));
    const existing = timers.current.get(next.id);
    if (existing) clearTimeout(existing);
    timers.current.set(next.id, setTimeout(() => persistQuestion(next), 500));
  };

  const changeName = (value: string) => {
    setName(value);
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(async () => {
      if (!value.trim()) return;
      try {
        await apiFetch(base, { method: 'PATCH', body: JSON.stringify({ name: value.trim() }) });
        flashSaved();
      } catch {
        /* ignore */
      }
    }, 500);
  };

  // --- CRUD --------------------------------------------------------------
  const addQuestion = async () => {
    if (locked || adding) return;
    setAdding(true);
    try {
      const { question } = await apiFetch<{ question: DraftQuestion }>(`${base}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'multiple_choice',
          questionText: '',
          options: ['', '', '', ''],
          correctAnswer: '',
          orderIndex: questions.length,
        }),
      });
      setQuestions((qs) => [...qs, question]);
      setExpandedId(question.id);
      flashSaved();
    } catch {
      /* ignore */
    } finally {
      setAdding(false);
    }
  };

  const deleteQuestion = async (id: string) => {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    try {
      await apiFetch(`${base}/questions/${id}`, { method: 'DELETE' });
    } catch {
      /* ignore */
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    const next = arrayMove(questions, oldIndex, newIndex);
    setQuestions(next);
    apiFetch(`${base}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ order: next.map((q) => q.id) }),
    }).catch(() => {});
  };

  // --- Pack actions ------------------------------------------------------
  const duplicate = async () => {
    setMenuOpen(false);
    try {
      const { id } = await apiFetch<{ id: string }>(`${base}/duplicate`, { method: 'POST' });
      router.push(`/play/packs/${id}/edit`);
    } catch {
      /* ignore */
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(base, { method: 'DELETE' });
      router.push('/play');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete this pack');
      setDeleting(false);
    }
  };

  const incompleteCount = questions.filter(isIncomplete).length;

  return (
    <div className="app-shell play-surface">
      {/* Header */}
      <header
        className="px-4 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)' }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/play')}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft"
            aria-label="Back to Play"
          >
            <ChevronLeft width={18} height={18} />
          </button>
          <input
            className="min-w-0 flex-1 bg-transparent font-display text-xl font-semibold text-ink outline-none"
            value={name}
            disabled={locked}
            onChange={(e) => changeName(e.target.value)}
            placeholder="Pack name"
          />
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft"
              aria-label="Pack actions"
            >
              ⋯
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                <div className="card absolute right-0 z-20 mt-2 w-44 animate-scale-in overflow-hidden p-1">
                  <button className="row-press w-full rounded-xl px-3 py-2.5 text-left text-sm" onClick={duplicate}>
                    Duplicate
                  </button>
                  <button
                    className="row-press w-full rounded-xl px-3 py-2.5 text-left text-sm"
                    onClick={() => {
                      setMenuOpen(false);
                      setPreviewOpen(true);
                    }}
                  >
                    Preview
                  </button>
                  {!locked && (
                    <button
                      className="row-press w-full rounded-xl px-3 py-2.5 text-left text-sm text-bad"
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmDelete(true);
                      }}
                    >
                      Delete pack
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="font-semibold text-ink-soft">
            {questions.length} {questions.length === 1 ? 'question' : 'questions'}
          </span>
          {questions.length < MIN_QUESTIONS_TO_PLAY && (
            <span className="text-warn">· need {MIN_QUESTIONS_TO_PLAY}+ to play</span>
          )}
          {incompleteCount > 0 && <span className="text-ink-faint">· {incompleteCount} incomplete</span>}
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1 font-semibold text-good transition-opacity duration-500',
              saved ? 'opacity-100' : 'opacity-0',
            )}
          >
            <Check width={13} height={13} /> Saved
          </span>
        </div>
      </header>

      {locked && (
        <div className="flex items-center gap-2 bg-warn/10 px-4 py-2.5 text-sm font-medium text-warn">
          <Lock width={15} height={15} /> This pack is in use during a live game. Editing is locked.
        </div>
      )}

      {/* Body */}
      <main className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {questions.length === 0 ? (
          <p className="mt-16 text-center text-ink-faint">No questions yet. Add your first one below.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {questions.map((q, i) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    index={i}
                    expanded={expandedId === q.id}
                    locked={locked}
                    onToggle={() => setExpandedId((cur) => (cur === q.id ? null : q.id))}
                    onChange={changeQuestion}
                    onDelete={() => deleteQuestion(q.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {!locked && (
          <button
            type="button"
            onClick={addQuestion}
            disabled={adding}
            className="btn-primary w-full disabled:opacity-50"
          >
            <Plus width={18} height={18} /> Add Question
          </button>
        )}
      </main>

      {previewOpen && (
        <PackPreview name={name} questions={questions} onClose={() => setPreviewOpen(false)} />
      )}

      <PlayConfirm
        open={confirmDelete}
        title="Delete pack?"
        message={`Delete "${name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={doDelete}
        onClose={() => {
          setConfirmDelete(false);
          setDeleteError(null);
        }}
        busy={deleting}
        error={deleteError}
      />
    </div>
  );
}
