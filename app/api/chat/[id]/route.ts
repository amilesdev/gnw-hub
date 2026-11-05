import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canCreateChats, canModerateChat } from '@/lib/access';
import { requireChat } from '@/lib/chat/guard';
import { chatMemberIds, deleteChat, getChatDetail } from '@/lib/chat/server';
import { pingUsers } from '@/lib/chat/realtime-server';
import { chatUpdateSchema, firstIssue } from '@/lib/chat/validation';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/chat/[id] — a chat or topic: name, topics, members, my mute, and
// what I'm allowed to do here.
export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireChat((await params).id);
  if ('error' in guard) return guard.error;
  return NextResponse.json({ chat: await getChatDetail(guard.access, guard.user) });
}

// PATCH /api/chat/[id] — { muted } (anyone, for themselves; set on the root so
// it covers the topics), { name } (super admin + leaders), { archived }
// (moderators). Each field is checked on its own.
export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireChat((await params).id);
  if ('error' in guard) return guard.error;
  const { user, access } = guard;

  const parsed = chatUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { name, archived, muted } = parsed.data;

  if (name !== undefined && !canCreateChats(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (archived !== undefined && !canModerateChat(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // A topic can't be restored while its whole chat is archived.
  if (archived === false && access.chat.parentId && access.root.archivedAt) {
    return NextResponse.json({ error: 'Restore the chat first.' }, { status: 409 });
  }

  if (muted !== undefined) {
    await prisma.chatMember.update({
      where: { id: access.membership.id },
      data: { mutedAt: muted ? new Date() : null },
    });
  }
  if (name !== undefined || archived !== undefined) {
    await prisma.chat.update({
      where: { id: access.chat.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
      },
    });
    after(async () => pingUsers(await chatMemberIds(access.root.id), { kind: 'chats', chatId: access.chat.id }));
  } else {
    // Mute only affects me — tell just my other devices.
    after(() => pingUsers([user.id], { kind: 'chats', chatId: access.chat.id }));
  }

  // Re-read so the response reflects the change (and the archive check).
  const fresh = await requireChat(access.chat.id);
  if ('error' in fresh) return NextResponse.json({ ok: true });
  return NextResponse.json({ chat: await getChatDetail(fresh.access, fresh.user) });
}

// DELETE /api/chat/[id] — permanently delete a chat (and its topics) or a topic.
// Moderators only, and only once archived, so it's always a deliberate second step.
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireChat((await params).id);
  if ('error' in guard) return guard.error;
  const { user, access } = guard;

  if (!canModerateChat(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!access.archived) return NextResponse.json({ error: 'Archive it first.' }, { status: 409 });

  // Read before the cascade takes the memberships with it.
  const memberIds = await chatMemberIds(access.root.id);
  await deleteChat(access.chat.id);
  after(() => pingUsers(memberIds, { kind: 'chats', chatId: access.chat.id }));
  return NextResponse.json({ ok: true });
}
