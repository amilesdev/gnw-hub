import { NextResponse } from 'next/server';
import { requireChat, requireChatUser } from '@/lib/chat/guard';
import { searchMessages } from '@/lib/chat/search';
import { chatSearchSchema, firstIssue } from '@/lib/chat/validation';

// GET /api/chat/search?q=…[&chat=<id>][&before=<messageId>&mode=words|text]
// `chat` = that chat and its topics (membership checked → 404 otherwise); no
// `chat` = every chat you're in. Newest hits first; `before` + the `mode` the
// first page returned fetch the next page.
export async function GET(req: Request) {
  const parsed = chatSearchSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { q, chat, before, mode } = parsed.data;

  if (chat) {
    const guard = await requireChat(chat);
    if ('error' in guard) return guard.error;
    return NextResponse.json(await searchMessages(guard.user, { q, access: guard.access, before, mode }));
  }
  const guard = await requireChatUser();
  if ('error' in guard) return guard.error;
  return NextResponse.json(await searchMessages(guard.user, { q, access: null, before, mode }));
}
