import { NextResponse, after } from 'next/server';
import { archivedError, chatErrorResponse, requireChat } from '@/lib/chat/guard';
import { getMessages, sendMessage } from '@/lib/chat/messages';
import { fanOutNewMessage } from '@/lib/chat/notify';
import { chatMessageSendSchema, firstIssue } from '@/lib/chat/validation';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/chat/[id]/messages[?before=<id>|?after=<id>|?around=<id>] — a page,
// oldest first. No cursor = the newest page; `before` = older (scrolling up);
// `after` = everything newer (catch-up after a realtime ping or app resume, or
// scrolling down after a jump); `around` = a page centred on one message
// (jumping to a search hit or a reply's original).
export async function GET(req: Request, { params }: Ctx) {
  const guard = await requireChat((await params).id);
  if ('error' in guard) return guard.error;
  const q = new URL(req.url).searchParams;
  const page = await getMessages(guard.access.chat.id, guard.user.id, {
    before: q.get('before') ?? undefined,
    after: q.get('after') ?? undefined,
    around: q.get('around') ?? undefined,
  });
  if (!page) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  return NextResponse.json(page);
}

// POST /api/chat/[id]/messages — send { text?, clientNonce, replyToId?,
// mentionIds?, mentionsAll?, attachments? }. Pings + pushes go out after the
// response, so the sender isn't kept waiting.
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireChat((await params).id);
  if ('error' in guard) return guard.error;
  const blocked = archivedError(guard.access);
  if (blocked) return blocked;

  const parsed = chatMessageSendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });

  try {
    const { message, created } = await sendMessage(guard.access, guard.user, parsed.data);
    if (created) after(() => fanOutNewMessage(guard.access, message));
    return NextResponse.json({ message }, { status: created ? 201 : 200 });
  } catch (err) {
    return chatErrorResponse(err);
  }
}
