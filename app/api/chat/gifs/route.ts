import { NextResponse } from 'next/server';
import { requireChatUser } from '@/lib/chat/guard';
import { GiphyError, giphyPage } from '@/lib/chat/giphy';
import { chatGifSearchSchema, firstIssue } from '@/lib/chat/validation';

// GET /api/chat/gifs?type=gifs|stickers[&q=…][&offset=n] — the GIF picker's
// results from GIPHY (trending with no `q`). Chat users only; the API key stays
// on the server and results are cached for everyone (lib/chat/giphy.ts).
export async function GET(req: Request) {
  const guard = await requireChatUser();
  if ('error' in guard) return guard.error;
  const parsed = chatGifSearchSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { type, q, offset } = parsed.data;
  try {
    return NextResponse.json(await giphyPage(type, q, offset));
  } catch (err) {
    if (err instanceof GiphyError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
