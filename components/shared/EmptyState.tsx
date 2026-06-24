import { Sparkle } from './Icons';
import type { Verse } from '@/lib/bible';

/** Friendly empty state with an encouraging message + a random KJV verse. */
export function EmptyState({ message, verse }: { message: string; verse?: Verse | null }) {
  return (
    <div className="card grain-block flex flex-col items-center px-6 py-8 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
        <Sparkle width={24} height={24} className="animate-breathe" />
      </div>
      <p className="mt-4 font-semibold text-ink">{message}</p>
      {verse?.text && (
        <figure className="mt-3">
          <blockquote className="font-display text-[0.98rem] italic leading-snug text-ink-soft">
            “{verse.text}”
          </blockquote>
          <figcaption className="eyebrow mt-2">{verse.reference}</figcaption>
        </figure>
      )}
    </div>
  );
}
