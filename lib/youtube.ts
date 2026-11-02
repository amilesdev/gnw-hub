// YouTube link helpers for song suggestions. Parsing is pure (safe on the
// client, used for instant validation as you paste); `fetchYouTubeMeta` hits
// YouTube's public oEmbed endpoint — no API key, no quota — and is only called
// from API routes (the endpoint isn't reliably CORS-enabled for the browser).

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Pull the 11-char video id out of anything a phone's share sheet produces:
 * youtube.com/watch?v=, youtu.be/, /shorts/, /live/, /embed/, m. and music.
 * hosts, with or without tracking params. Null when it isn't a YouTube video.
 */
export function parseYouTubeId(input: string): string | null {
  let url: URL;
  try {
    const raw = input.trim();
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');

  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      const [, kind, rest] = url.pathname.split('/');
      if (kind === 'shorts' || kind === 'live' || kind === 'embed' || kind === 'v') id = rest ?? null;
    }
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** 320×180 still — exists for every video, so it's derived rather than stored. */
export function youTubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export type YouTubeMeta = { videoTitle: string; channelName: string };

/**
 * Look up a video's title + channel. Returns `'not_found'` when YouTube says the
 * video doesn't exist / is private, and `null` when the lookup itself failed
 * (network, timeout) — callers then fall back to asking for the title by hand.
 */
export async function fetchYouTubeMeta(videoId: string): Promise<YouTubeMeta | 'not_found' | null> {
  const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youTubeWatchUrl(videoId))}`;
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) return 'not_found';
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: unknown; author_name?: unknown };
    if (typeof data.title !== 'string') return null;
    return {
      videoTitle: data.title,
      channelName: typeof data.author_name === 'string' ? data.author_name : '',
    };
  } catch {
    return null;
  }
}

// Bracketed asides that describe the upload, not the song: "(Official Video)",
// "[Lyric Video]", "(Live)", "(Audio)", "(HD)"… Feature credits are kept.
const NOISE_GROUP = /\s*[([{]([^)\]}]*)[)\]}]/g;
const NOISE_WORDS = /\b(official|lyrics?|audio|video|visuali[sz]er|music video|mv|live|performance|hd|hq|4k|remaster(ed)?)\b/i;

function stripNoise(s: string): string {
  return s
    .replace(NOISE_GROUP, (group, inner: string) => (NOISE_WORDS.test(inner) ? '' : group))
    .replace(/["“”]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-–—|:]+$/, '')
    .trim();
}

function cleanChannel(channel: string): string {
  return channel
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/\s+official$/i, '')
    .trim();
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Best-effort song title + artist from a video's title and channel. Handles the
 * usual shapes — "Artist - Song (Official Video)", "Song | Artist", "Song (Live)"
 * on the artist's channel, and YouTube Music's auto "Artist - Topic" channels.
 * It's a guess; the suggester can correct it before submitting.
 */
export function guessSong(videoTitle: string, channelName: string): { songTitle: string; artist: string | null } {
  const channel = cleanChannel(channelName);

  // Auto-generated YouTube Music uploads: the title IS the song.
  if (/\s-\s*Topic$/i.test(channelName)) {
    return { songTitle: stripNoise(videoTitle) || videoTitle.trim(), artist: channel || null };
  }

  const segments = videoTitle.split(/\s+[|｜•]\s+/).map((s) => s.trim()).filter(Boolean);
  const main = segments[0] ?? videoTitle;

  const dash = main.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dash) {
    let [, left, right] = dash;
    // "Song - Artist" is rarer but common enough: swap when only the right
    // side names the channel.
    const c = norm(channel);
    if (c && norm(right).includes(c) && !norm(left).includes(c)) [left, right] = [right, left];
    return { songTitle: stripNoise(right) || right.trim(), artist: stripNoise(left) || null };
  }

  // "Song | Artist | Label": the segment right after the song is the artist —
  // unless it's an upload note ("Live at…", "Official Lyric Video"), in which
  // case the channel is the best guess.
  const second = segments[1] && !NOISE_WORDS.test(segments[1]) && !/\bat\b/i.test(segments[1]) ? segments[1] : null;
  return { songTitle: stripNoise(main) || main.trim(), artist: (second && stripNoise(second)) || channel || null };
}
