import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { suggestionCreateSchema } from '@/lib/validation';
import { serializeSuggestion } from '@/lib/serialize';
import { fetchYouTubeMeta, guessSong, parseYouTubeId, youTubeWatchUrl } from '@/lib/youtube';
import { duplicateReason, getSuggestions, notifyLeadersOfSuggestion } from '@/lib/suggestions';

// GET /api/suggestions — the team's suggestions, newest first (see
// getSuggestions for who sees passed-on ones).
export async function GET() {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  return NextResponse.json({ suggestions: await getSuggestions(guard.user) });
}

// POST /api/suggestions — suggest a song from a YouTube link. Any user. The
// title/artist come from the video unless the suggester corrected them.
export async function POST(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const me = guard.user;

  const body = await req.json().catch(() => null);
  const parsed = suggestionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const d = parsed.data;

  const videoId = parseYouTubeId(d.url);
  if (!videoId) {
    return NextResponse.json({ error: 'That doesn’t look like a YouTube link.' }, { status: 400 });
  }

  const duplicate = await duplicateReason(videoId);
  if (duplicate) return NextResponse.json({ error: duplicate }, { status: 409 });

  const meta = await fetchYouTubeMeta(videoId);
  if (meta === 'not_found') {
    return NextResponse.json({ error: 'Couldn’t find that video — it may be private or removed.' }, { status: 404 });
  }
  const guess = meta ? guessSong(meta.videoTitle, meta.channelName) : null;

  const songTitle = d.songTitle || guess?.songTitle;
  if (!songTitle) {
    return NextResponse.json({ error: 'Add the song title.' }, { status: 400 });
  }
  // An explicit (even empty) artist from the client wins over the guess.
  const artist = d.artist !== undefined ? d.artist || null : (guess?.artist ?? null);

  const created = await prisma.songSuggestion.create({
    data: {
      videoId,
      url: youTubeWatchUrl(videoId),
      songTitle,
      artist,
      videoTitle: meta?.videoTitle ?? null,
      channelName: meta?.channelName ?? null,
      suggestedById: me.id,
      suggestedByName: me.name ?? 'Someone',
    },
  });
  const suggestion = serializeSuggestion(created);

  await notifyLeadersOfSuggestion(suggestion);

  return NextResponse.json({ suggestion }, { status: 201 });
}
