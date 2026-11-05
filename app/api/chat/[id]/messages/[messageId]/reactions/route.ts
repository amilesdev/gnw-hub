import { NextResponse, after } from 'next/server';
import { archivedError, chatErrorResponse, requireChat } from '@/lib/chat/guard';
import { getMessage, setReaction } from '@/lib/chat/messages';
import { pingMessageUpdate } from '@/lib/chat/notify';
import { chatReactionSchema, firstIssue } from '@/lib/chat/validation';

type Ctx = { params: Promise<{ id: string; messageId: string }> };

// POST /api/chat/[id]/messages/[messageId]/reactions { emoji, on } — add or
// remove your reaction. Returns the updated message.
export async function POST(req: Request, { params }: Ctx) {
  const { id, messageId } = await params;
  const guard = await requireChat(id);
  if ('error' in guard) return guard.error;
  const blocked = archivedError(guard.access);
  if (blocked) return blocked;

  const parsed = chatReactionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });

  try {
    await setReaction(guard.access, guard.user, messageId, parsed.data.emoji, parsed.data.on);
  } catch (err) {
    return chatErrorResponse(err);
  }
  after(() => pingMessageUpdate(guard.access, messageId));
  return NextResponse.json({ message: await getMessage(guard.access.chat.id, messageId, guard.user.id) });
}
