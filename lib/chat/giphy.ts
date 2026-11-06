import 'server-only';
import { unstable_cache } from 'next/cache';
import { GIPHY_PAGE_SIZE, GIPHY_RATING, isGiphyId, type ChatGifPageDTO, type ChatGifResultDTO, type GiphyFile } from './types';

// GIF/sticker search for the chat picker. Every call goes through our server:
// the key (GIPHY_API_KEY, server-only) never reaches a phone, nobody's searches
// go to GIPHY from their own device, and results are cached and shared, which
// matters because the free key allows 100 calls an hour for the whole app.
// Sent GIFs are linked (see giphyPath in types.ts), never copied to our storage.

const API = 'https://api.giphy.com/v1';
const TRENDING_TTL_S = 30 * 60;
const SEARCH_TTL_S = 6 * 60 * 60;
/** Send the full file when it's at most this big; otherwise the 200px-wide one. */
const FULL_FILE_MAX_BYTES = 2.5 * 1024 * 1024;

export class GiphyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Rendition = { width?: string; height?: string; webp_size?: string; size?: string };
type GiphyItem = {
  id: string;
  title?: string;
  alt_text?: string;
  images?: { original?: Rendition; fixed_width?: Rendition; fixed_width_downsampled?: Rendition };
};

const int = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

function toResult(g: GiphyItem, kind: 'gif' | 'sticker'): ChatGifResultDTO | null {
  if (!isGiphyId(g.id)) return null;
  const orig = g.images?.original;
  const small = g.images?.fixed_width;
  const thumb = g.images?.fixed_width_downsampled ?? small;
  const full = orig && int(orig.width) && int(orig.webp_size || orig.size) <= FULL_FILE_MAX_BYTES;
  const send = full ? orig : small;
  const file: GiphyFile = full ? 'giphy.webp' : '200w.webp';
  if (!send || !int(send.width) || !int(send.height) || !thumb) return null;
  return {
    id: g.id,
    kind,
    title: (g.alt_text || g.title || '').trim().slice(0, 200),
    // The downsampled 200px file keeps a page of results light on cellular.
    previewUrl: `https://media.giphy.com/media/${g.id}/200w_d.webp`,
    previewWidth: int(thumb.width) || 200,
    previewHeight: int(thumb.height) || 200,
    file,
    width: int(send.width),
    height: int(send.height),
  };
}

async function fetchPage(type: 'gifs' | 'stickers', q: string, offset: number): Promise<ChatGifPageDTO> {
  const key = process.env.GIPHY_API_KEY?.trim();
  if (!key) throw new GiphyError('GIFs aren’t set up yet.', 503);
  const params = new URLSearchParams({ api_key: key, limit: String(GIPHY_PAGE_SIZE), offset: String(offset), rating: GIPHY_RATING });
  if (q) params.set('q', q);
  if (q) params.set('lang', 'en');
  const res = await fetch(`${API}/${type}/${q ? 'search' : 'trending'}?${params}`, { cache: 'no-store' });
  if (res.status === 429) throw new GiphyError('GIFs are busy right now. Try again in a few minutes.', 503);
  if (!res.ok) throw new GiphyError('Couldn’t reach GIPHY. Try again.', 502);
  const body = (await res.json()) as { data?: GiphyItem[]; pagination?: { total_count?: number; count?: number; offset?: number } };
  const kind = type === 'gifs' ? 'gif' : 'sticker';
  const results = (body.data ?? []).map((g) => toResult(g, kind)).filter((r): r is ChatGifResultDTO => r !== null);
  const p = body.pagination;
  const seen = (p?.offset ?? offset) + (p?.count ?? results.length);
  return { results, hasMore: results.length > 0 && seen < Math.min(p?.total_count ?? 0, 4999) };
}

// Shared across everyone (results don't depend on who asks). A thrown error is
// never cached, so a rate-limited moment doesn't stick.
const trending = unstable_cache((type: 'gifs' | 'stickers', offset: number) => fetchPage(type, '', offset), ['chat-giphy-trending'], {
  revalidate: TRENDING_TTL_S,
});
const search = unstable_cache((type: 'gifs' | 'stickers', q: string, offset: number) => fetchPage(type, q, offset), ['chat-giphy-search'], {
  revalidate: SEARCH_TTL_S,
});

/** Trending (no query) or search results, `GIPHY_PAGE_SIZE` at a time. */
export function giphyPage(type: 'gifs' | 'stickers', q: string, offset: number): Promise<ChatGifPageDTO> {
  // "Amen", "amen " and "AMEN" share one cache entry (and one GIPHY call).
  const query = q.toLowerCase().replace(/\s+/g, ' ').trim();
  return query ? search(type, query, offset) : trending(type, offset);
}
