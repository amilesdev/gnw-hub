import { z } from 'zod';
import {
  CHAT_MAX_ATTACHMENTS,
  CHAT_MEDIA_MAX_BYTES,
  CHAT_NAME_MAX,
  CHAT_SEARCH_MAX,
  CHAT_TEXT_MAX,
  isSingleEmoji,
} from './types';

const name = z
  .string()
  .trim()
  .min(1, 'Give it a name.')
  .max(CHAT_NAME_MAX, `Keep the name under ${CHAT_NAME_MAX} characters.`);

const userIds = z.array(z.string().min(1).max(64)).max(500);

export const chatCreateSchema = z.object({ name, memberIds: userIds.default([]) });

export const chatTopicCreateSchema = z.object({ name });

export const chatUpdateSchema = z
  .object({ name: name.optional(), archived: z.boolean().optional(), muted: z.boolean().optional() })
  .refine((d) => d.name !== undefined || d.archived !== undefined || d.muted !== undefined, 'Nothing to change.');

export const chatMembersAddSchema = z.object({ userIds: userIds.min(1, 'Pick at least one person.') });

const messageText = z.string().trim().max(CHAT_TEXT_MAX, `Messages can be up to ${CHAT_TEXT_MAX} characters.`);
const id = z.string().min(1).max(64);
const storagePath = z.string().min(1).max(300);

const attachmentInput = z.object({
  kind: z.enum(['image', 'video']),
  path: storagePath,
  posterPath: storagePath.nullish(),
  width: z.number().int().positive().max(20000).nullish(),
  height: z.number().int().positive().max(20000).nullish(),
  durationSec: z.number().nonnegative().max(24 * 3600).nullish(),
  sizeBytes: z.number().int().positive().max(CHAT_MEDIA_MAX_BYTES, 'Each photo or video can be up to 100 MB.'),
});

// Text is optional when there are photos/videos (sendMessage checks one or the other).
export const chatMessageSendSchema = z.object({
  text: messageText.optional(),
  clientNonce: z.string().min(8).max(64).optional(),
  replyToId: id.optional(),
  mentionIds: z.array(id).max(200).optional(),
  mentionsAll: z.boolean().optional(),
  attachments: z.array(attachmentInput).max(CHAT_MAX_ATTACHMENTS, `Up to ${CHAT_MAX_ATTACHMENTS} photos or videos per message.`).optional(),
});

export const chatMessagePatchSchema = z
  .object({ text: messageText.optional(), pinned: z.boolean().optional() })
  .refine((d) => d.text !== undefined || d.pinned !== undefined, 'Nothing to change.');

export const chatReactionSchema = z.object({
  emoji: z.string().refine(isSingleEmoji, 'Pick one emoji.'),
  on: z.boolean(),
});

export const chatUploadSchema = z.object({
  files: z
    .array(
      z.object({
        type: z.string().regex(/^(image|video)\/[\w.+-]+$/, 'Only photos and videos can be shared.'),
        size: z.number().int().positive().max(CHAT_MEDIA_MAX_BYTES, 'Each photo or video can be up to 100 MB.'),
      }),
    )
    .min(1)
    // A video brings its poster frame, so allow two per attachment.
    .max(CHAT_MAX_ATTACHMENTS * 2),
});

export const chatReadSchema = z.object({ viewing: z.boolean().optional() });

export const chatSearchSchema = z.object({
  q: z.string().trim().min(1, 'Type something to search for.').max(CHAT_SEARCH_MAX, 'That search is too long.'),
  chat: id.optional(),
  before: id.optional(),
  mode: z.enum(['words', 'text']).optional(),
});

export function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Invalid input';
}
