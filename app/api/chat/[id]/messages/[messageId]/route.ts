import { NextResponse, after } from 'next/server';
import { archivedError, chatErrorResponse, requireChat } from '@/lib/chat/guard';
import { deleteMessage, editMessage, getMessage, setPinned } from '@/lib/chat/messages';
import { pingMessageUpdate } from '@/lib/chat/notify';
import { chatMessagePatchSchema, firstIssue } from '@/lib/chat/validation';

type Ctx = { params: Promise<{ id: string; messageId: string }> };

// GET /api/chat/[id]/messages/[messageId] — one message (refetched after an
// `update` ping: edited, deleted, reacted to, pinned).
export async function GET(_req: Request, { params }: Ctx) {
  const { id, messageId } = await params;
  const guard = await requireChat(id);
  if ('error' in guard) return guard.error;
  const message = await getMessage(guard.access.chat.id, messageId, guard.user.id);
  if (!message) return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
  return NextResponse.json({ message });
}

// PATCH /api/chat/[id]/messages/[messageId] — { text } edits your own message
// (15-minute window); { pinned } pins/unpins (anyone in the chat).
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, messageId } = await params;
  const guard = await requireChat(id);
  if ('error' in guard) return guard.error;
  const blocked = archivedError(guard.access);
  if (blocked) return blocked;

  const parsed = chatMessagePatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });

  try {
    if (parsed.data.text !== undefined) await editMessage(guard.access, guard.user, messageId, parsed.data.text);
    if (parsed.data.pinned !== undefined) await setPinned(guard.access, guard.user, messageId, parsed.data.pinned);
  } catch (err) {
    return chatErrorResponse(err);
  }
  after(() => pingMessageUpdate(guard.access, messageId));
  return NextResponse.json({ message: await getMessage(guard.access.chat.id, messageId, guard.user.id) });
}

// DELETE /api/chat/[id]/messages/[messageId] — your own message anytime;
// moderators can delete anyone's. Leaves "message deleted" in place.
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, messageId } = await params;
  const guard = await requireChat(id);
  if ('error' in guard) return guard.error;
  try {
    await deleteMessage(guard.access, guard.user, messageId);
  } catch (err) {
    return chatErrorResponse(err);
  }
  after(() => pingMessageUpdate(guard.access, messageId));
  return NextResponse.json({ message: await getMessage(guard.access.chat.id, messageId, guard.user.id) });
}
