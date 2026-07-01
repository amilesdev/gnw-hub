import type { Verse } from '@/lib/bible';

/**
 * Verse-of-the-day ribbon for the top of the home screen — a small devotional
 * anchor set in the serif display face. Stable for the whole day
 * (see getVerseOfDay).
 */
export function VerseRibbon({ verse }: { verse: Verse }) {
  if (!verse?.text) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-accent-soft to-surface px-4 py-3.5">
      <blockquote className="font-display text-[0.95rem] font-medium italic leading-snug text-ink">
        “{verse.text}”
      </blockquote>
      <figcaption className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-accent-ink dark:text-accent-on">
        {verse.reference} · Verse of the day
      </figcaption>
    </div>
  );
}
