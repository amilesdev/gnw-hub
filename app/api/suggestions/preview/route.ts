import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { fetchYouTubeMeta, guessSong, parseYouTubeId, youTubeThumbnail, youTubeWatchUrl } from '@/lib/youtube';
import { duplicateReason } from '@/lib/suggestions';

// GET /api/suggestions/preview?url=<youtube link> — what the composer shows
// before you submit: the guessed title/artist, the thumbnail, and whether the
// song is already in the library or suggested. `found: false` means the lookup
// itself failed (YouTube unreachable), so the UI asks for the title by hand.
export async function GET(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const raw = new URL(req.url).searchParams.get('url') ?? '';
  const videoId = parseYouTubeId(raw);
  if (!videoId) {
    return NextResponse.json({ error: 'That doesn’t look like a YouTube link.' }, { status: 400 });
  }

  const [meta, duplicate] = await Promise.all([fetchYouTubeMeta(videoId), duplicateReason(videoId)]);
  if (meta === 'not_found') {
    return NextResponse.json(
      { error: 'Couldn’t find that video — it may be private or removed.' },
      { status: 404 },
    );
  }

  const guess = meta ? guessSong(meta.videoTitle, meta.channelName) : { songTitle: '', artist: null };
  return NextResponse.json({
    videoId,
    url: youTubeWatchUrl(videoId),
    thumbnailUrl: youTubeThumbnail(videoId),
    found: meta !== null,
    songTitle: guess.songTitle,
    artist: guess.artist,
    duplicate,
  });
}
