import type { Verse } from '@/lib/bible';

/**
 * Verse of the day (HM-C2), a card near the top of Home: the verse in Literata
 * italic with its reference as an eyebrow. Stable for the whole day (see
 * getVerseOfDay).
 */
export function VerseRibbon({ verse }: { verse: Verse }) {
  if (!verse?.text) return null;
  return (
    <figure className="card grain-block selectable flex flex-col gap-2 px-5 py-[18px]">
      <blockquote className="verse relative text-ink">“{verse.text}”</blockquote>
      <figcaption className="eyebrow relative text-accent-ink">{verse.reference} · Verse of the day</figcaption>
    </figure>
  );
}
