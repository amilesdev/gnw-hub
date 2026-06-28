import { z } from 'zod';

// --- Pack Builder --------------------------------------------------------

export const packCreateSchema = z.object({
  name: z.string().trim().min(1, 'Pack name is required').max(80),
});

export const packRenameSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

// A question upsert from the builder. correctAnswer must be one of options
// (validated in the route against the actual options array).
export const questionUpsertSchema = z.object({
  id: z.string().optional(), // present ⇒ update, absent ⇒ create
  type: z.enum(['multiple_choice', 'true_false']),
  questionText: z.string().max(500).default(''),
  options: z.array(z.string().max(200)),
  correctAnswer: z.string().max(200).default(''),
  orderIndex: z.number().int().min(0),
});

export const reorderSchema = z.object({
  order: z.array(z.string()).min(1), // question ids in new order
});

// --- Game setup ----------------------------------------------------------

export const createSessionSchema = z.object({
  packId: z.string().min(1),
  mode: z.enum(['classic', 'team_battle', 'survival']),
  settings: z.object({
    time_per_question: z.number().int().min(5).max(60),
    shuffle: z.boolean(),
    team_names: z.tuple([z.string().trim().min(1), z.string().trim().min(1)]).optional(),
  }),
  guestAccess: z.boolean().default(false),
});

// --- Live game -----------------------------------------------------------

export const submitAnswerSchema = z.object({
  sessionId: z.string().min(1),
  questionId: z.string().min(1),
  answer: z.string().max(200),
});

export const sessionIdSchema = z.object({ sessionId: z.string().min(1) });

export const removePlayerSchema = z.object({
  sessionId: z.string().min(1),
  playerId: z.string().min(1),
});

export const assignTeamsSchema = z.object({
  sessionId: z.string().min(1),
  // map of playerId -> team name
  assignments: z.record(z.string(), z.string()),
});

export const guestJoinSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1, 'Enter your name').max(40),
});

export const MIN_QUESTIONS_TO_PLAY = 5;
