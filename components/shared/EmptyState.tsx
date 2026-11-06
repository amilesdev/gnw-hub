import { Sparkle } from './Icons';
import { cn } from '@/lib/utils';
import type { Verse } from '@/lib/bible';
import type { ComponentType, ReactNode } from 'react';

type IconProps = { width?: number; height?: number; className?: string };

/**
 * Friendly empty state (CMP-14): icon tile, optional chip, title, body, an
 * optional KJV verse and an optional action. `message` alone is the title.
 */
export function EmptyState({
  message,
  body,
  chip,
  verse,
  action,
  icon: Icon = Sparkle,
  className,
}: {
  message: string;
  body?: ReactNode;
  chip?: string;
  verse?: Verse | null;
  action?: ReactNode;
  icon?: ComponentType<IconProps>;
  className?: string;
}) {
  return (
    <div className={cn('card grain-block flex flex-col items-center gap-3 px-6 py-8 text-center', className)}>
      <div className="grid h-14 w-14 place-items-center rounded-[20px] bg-accent-soft text-accent-ink">
        <Icon width={28} height={28} className="animate-breathe" />
      </div>
      {chip && <span className="chip bg-surface-2 text-ink-soft">{chip}</span>}
      <p className="text-[17px] font-semibold leading-6 text-ink">{message}</p>
      {body && <p className="text-[15px] leading-[22px] text-ink-soft [text-wrap:pretty]">{body}</p>}
      {verse?.text && (
        <figure>
          <blockquote className="font-display text-base italic leading-6 text-ink-soft">
            “{verse.text}”
          </blockquote>
          <figcaption className="eyebrow mt-2">{verse.reference}</figcaption>
        </figure>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Inline empty for a list or search ("No songs match that search."). */
export function InlineEmpty({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-faint', className)}>{children}</p>
  );
}
