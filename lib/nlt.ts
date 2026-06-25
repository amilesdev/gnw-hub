/**
 * NLT scripture lookup via Tyndale's official NLT API (api.nlt.to).
 *
 * SERVER-ONLY: reads `NLT_API_KEY` and is imported solely by the
 * `/api/scripture` route handler. Never import this from a client component —
 * it would leak the key into the browser bundle.
 *
 * The API returns an HTML fragment (not JSON). A valid reference yields a
 * `<div id="bibletext">` with one or more `<verse_export>` blocks; an
 * unrecognized reference returns HTTP 200 with an EMPTY body — that's how we
 * detect "not found".
 *
 * NLT licensing: the text is copyrighted. We never persist it (no DB cache),
 * the API key stays server-side, and every rendering shows the required
 * attribution (`COPYRIGHT`). See Docs/CLAUDE.md.
 */

export type ScripturePassage = {
  reference: string;
  translation: 'NLT';
  verses: { number: number | null; text: string }[];
  copyright: string;
};

/** Tyndale's required attribution for NLT quotations. */
export const COPYRIGHT =
  'Scripture quotations are taken from the Holy Bible, New Living Translation, ' +
  'copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission ' +
  'of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.';

const API_BASE = 'https://api.nlt.to/api/passages';

/** Carries an HTTP status so the route can pass through a sensible code. */
export class ScriptureError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ScriptureError';
  }
}

/**
 * Fetch a passage. Returns `null` when the reference can't be resolved
 * (empty body or no parseable verses). Throws `ScriptureError` for
 * configuration/network/service problems.
 */
export async function fetchPassage(rawRef: string): Promise<ScripturePassage | null> {
  const ref = rawRef.replace(/\s+/g, ' ').trim();
  if (!ref) return null;

  const key = process.env.NLT_API_KEY;
  if (!key) throw new ScriptureError('Scripture lookup is not configured.', 503);

  const url = `${API_BASE}?ref=${encodeURIComponent(ref)}&version=NLT&key=${encodeURIComponent(key)}`;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new ScriptureError('Could not reach the scripture service.', 502);
  }
  if (!res.ok) throw new ScriptureError('The scripture service returned an error.', 502);

  const html = (await res.text()).trim();
  if (!html) return null; // empty body = reference not recognized

  const parsed = parsePassage(html);
  if (!parsed || parsed.verses.length === 0) return null;
  return parsed;
}

function parsePassage(html: string): ScripturePassage | null {
  const blockMatch = html.match(/<div id="bibletext"[\s\S]*<\/div>/i);
  const block = blockMatch ? blockMatch[0] : html;

  const headerMatch = block.match(/<h2[^>]*class="bk_ch_vs_header"[^>]*>([\s\S]*?)<\/h2>/i);
  const reference = headerMatch
    ? stripTags(headerMatch[1]).replace(/,\s*NLT\s*$/i, '').trim()
    : '';

  // Strip footnote popups + their markers before extracting any text.
  // A `<span class="tn">` footnote wraps a nested `<span class="tn-ref">`, so a
  // plain non-greedy match would stop at the inner `</span>` and leak the note.
  // The pattern below tolerates one level of nested spans (and other tags).
  const cleaned = block
    .replace(
      /<span class="tn">(?:[^<]|<(?!span\b)[^>]*>|<span\b[^>]*>[\s\S]*?<\/span>)*?<\/span>/gi,
      '',
    )
    .replace(/<a class="a-tn">[\s\S]*?<\/a>/gi, '');

  const verses: ScripturePassage['verses'] = [];
  const exportRe = /<verse_export\b[^>]*>([\s\S]*?)<\/verse_export>/gi;
  let m: RegExpExecArray | null;
  while ((m = exportRe.exec(cleaned)) !== null) {
    const inner = m[1];
    const vn = inner.match(/<span class="vn">(\d+)<\/span>/i);
    const number = vn ? Number(vn[1]) : null;
    const body = inner
      .replace(/<h3[^>]*class="chapter-number"[^>]*>[\s\S]*?<\/h3>/gi, '')
      .replace(/<h4[^>]*class="subhead"[^>]*>[\s\S]*?<\/h4>/gi, '')
      .replace(/<span class="vn">\d+<\/span>/gi, '');
    const text = stripTags(body);
    if (text) verses.push({ number, text });
  }

  if (verses.length === 0) {
    // Last-ditch fallback: flatten whatever's left into one run.
    const text = stripTags(cleaned.replace(/<h2[\s\S]*?<\/h2>/i, ''));
    if (!text) return null;
    return { reference, translation: 'NLT', verses: [{ number: null, text }], copyright: COPYRIGHT };
  }

  return { reference, translation: 'NLT', verses, copyright: COPYRIGHT };
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&#8217;/g, '’')
    .replace(/&lsquo;|&#8216;/g, '‘')
    .replace(/&ldquo;|&#8220;/g, '“')
    .replace(/&rdquo;|&#8221;/g, '”')
    .replace(/&mdash;|&#8212;/g, '—')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?’”])/g, '$1') // tighten space left before punctuation
    .trim();
}
