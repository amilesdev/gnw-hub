import 'server-only';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { canUseChat } from '@/lib/access';
import { getChatAccess, type ChatAccess, type ChatViewer } from './server';
import { ChatInputError } from './messages';

/**
 * Route guard for every /api/chat route: signed in AND allowed to use chat
 * (`canUseChat`, leaders only during the soft launch). Anyone else gets 404,
 * as if chat weren't there.
 */
export async function requireChatUser(): Promise<{ error: NextResponse } | { user: ChatViewer }> {
  const guard = await requireUser();
  if (!guard.user) return { error: guard.error! };
  if (!canUseChat(guard.user)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { user: guard.user };
}

/**
 * Route guard for /api/chat/[id]/*: {@link requireChatUser} AND a member of the
 * chat's root. Not a member → 404 (not 403), so chat ids don't confirm a chat exists.
 */
export async function requireChat(
  chatId: string,
): Promise<{ error: NextResponse } | { user: ChatViewer; access: ChatAccess }> {
  const guard = await requireChatUser();
  if ('error' in guard) return guard;
  const access = await getChatAccess(chatId, guard.user);
  if (!access) return { error: NextResponse.json({ error: 'Chat not found' }, { status: 404 }) };
  return { user: guard.user, access };
}

/** Turn a rule violation from lib/chat/messages.ts into its HTTP response; rethrow anything else. */
export function chatErrorResponse(err: unknown): NextResponse {
  if (err instanceof ChatInputError) return NextResponse.json({ error: err.message }, { status: err.status });
  throw err;
}

/** Writes are refused on an archived chat/topic (moderators can still open it). */
export function archivedError(access: ChatAccess): NextResponse | null {
  return access.archived
    ? NextResponse.json({ error: 'This chat is archived.' }, { status: 409 })
    : null;
}
