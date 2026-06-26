import type { docs_v1 } from 'googleapis';
import type { LyricChart, LyricLine } from './setlist-serialize';

// Re-export so callers can import the chart types from the parser too.
export type { LyricChart, LyricLine } from './setlist-serialize';

const HEADING_STYLES = new Set(['HEADING_1', 'HEADING_2', 'HEADING_3']);

/**
 * Turn a Google Docs API document into a structured lyric chart.
 *
 * Walks `document.body.content`, classifying each paragraph as a section label
 * (bold or heading-styled), a lyric line, or a blank spacer. Section labels are
 * how leaders mark verse/chorus/bridge in the source doc.
 */
export function parseGoogleDoc(doc: docs_v1.Schema$Document): LyricChart {
  const lines: LyricLine[] = [];

  for (const item of doc.body?.content ?? []) {
    // Document-level formatting artifact — nothing to render.
    if (item.sectionBreak) continue;
    const paragraph = item.paragraph;
    if (!paragraph) continue;

    const elements = paragraph.elements ?? [];
    const text = elements
      .map((el) => el.textRun?.content ?? '')
      .join('')
      .replace(/\n+$/, ''); // trim trailing newline(s)

    if (text.trim() === '') {
      lines.push({ type: 'blank', text: '', bold: false });
      continue;
    }

    const namedStyle = paragraph.paragraphStyle?.namedStyleType ?? '';
    const hasBoldRun = elements.some((el) => el.textRun?.textStyle?.bold === true);

    if (hasBoldRun || HEADING_STYLES.has(namedStyle)) {
      lines.push({ type: 'section', text: text.trim(), bold: true });
    } else {
      lines.push({ type: 'lyric', text, bold: false });
    }
  }

  return {
    title: doc.title ?? 'Untitled',
    lines: normalize(lines),
    parsedAt: new Date().toISOString(),
  };
}

/**
 * Tidy the raw line list:
 * - drop lines that are only whitespace (already classified as blank, but be safe)
 * - collapse runs of 3+ blank lines down to 2
 * - trim leading and trailing blanks from the whole chart
 */
function normalize(lines: LyricLine[]): LyricLine[] {
  const cleaned = lines.map((l) =>
    l.type !== 'blank' && l.text.trim() === '' ? { type: 'blank' as const, text: '', bold: false } : l,
  );

  const collapsed: LyricLine[] = [];
  let blankRun = 0;
  for (const line of cleaned) {
    if (line.type === 'blank') {
      blankRun += 1;
      if (blankRun > 2) continue; // keep at most 2 consecutive blanks
    } else {
      blankRun = 0;
    }
    collapsed.push(line);
  }

  let start = 0;
  let end = collapsed.length;
  while (start < end && collapsed[start].type === 'blank') start += 1;
  while (end > start && collapsed[end - 1].type === 'blank') end -= 1;
  return collapsed.slice(start, end);
}
