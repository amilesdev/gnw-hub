import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';
import { isQuestionIncomplete } from './validation';
import type { Prisma, Question, QuestionPack } from '@prisma/client';

/**
 * The columns needed to judge a pack's readiness. Play home and game setup both
 * list packs and both have to say whether each one can actually be launched, so
 * they select this and hand the rows to `countIncomplete` rather than each
 * re-deriving the rule.
 */
export const QUESTION_READINESS_SELECT = {
  questionText: true,
  options: true,
  correctAnswer: true,
} as const;

/** How many of a pack's questions are unfinished (see `isQuestionIncomplete`). */
export function countIncomplete(
  questions: { questionText: string; options: Prisma.JsonValue; correctAnswer: string }[],
): number {
  return questions.filter((q) =>
    isQuestionIncomplete({
      questionText: q.questionText,
      options: (q.options as string[]) ?? [],
      correctAnswer: q.correctAnswer,
    }),
  ).length;
}

// A pack is locked (read-only) while a session that uses it is live, so the
// questions can't change mid-game (system constraint).
export async function isPackLocked(packId: string): Promise<boolean> {
  const live = await prisma.gameSession.findFirst({
    where: { packId, status: { in: ['lobby', 'active'] } },
    select: { id: true },
  });
  return live !== null;
}

type PackGuard =
  | { error: NextResponse }
  | { pack: QuestionPack; userId: string };

/**
 * Require a leader who owns the pack (or the super-admin). Used by every
 * builder mutation. Returns the pack so callers don't re-fetch.
 */
export async function requirePackOwner(packId: string): Promise<PackGuard> {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'leader') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };

  const pack = await prisma.questionPack.findUnique({ where: { id: packId } });
  if (!pack) return { error: NextResponse.json({ error: 'Pack not found' }, { status: 404 }) };
  if (pack.createdById !== user.id && !user.isSuperAdmin) {
    return { error: NextResponse.json({ error: 'Not your pack' }, { status: 403 }) };
  }
  return { pack, userId: user.id };
}

export interface SerializedQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false';
  questionText: string;
  options: string[];
  correctAnswer: string;
  orderIndex: number;
}

export interface SerializedPack {
  id: string;
  name: string;
  locked: boolean;
  questions: SerializedQuestion[];
}

export function serializeQuestion(q: Question): SerializedQuestion {
  return {
    id: q.id,
    type: q.type,
    questionText: q.questionText,
    options: (q.options as string[]) ?? [],
    correctAnswer: q.correctAnswer,
    orderIndex: q.orderIndex,
  };
}
