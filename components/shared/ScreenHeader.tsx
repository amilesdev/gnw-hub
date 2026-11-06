import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ExternalLink } from './Icons';

/**
 * The one screen header (CMP-3).
 * - Tab root: eyebrow + page title on the left, optional actions bottom-aligned
 *   on the right. Reserves 56px on the right for the floating avatar.
 * - Sub-page (Suggestions, availability): pass `back` for the glass back pill
 *   naming the parent, which links to the parent route (not history.back()), so
 *   a push link still lands somewhere sensible.
 */
export function ScreenHeader({
  eyebrow,
  title,
  actions,
  back,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header className={cn('mb-6', className)}>
      {back && (
        <div className="mb-4 flex h-11 items-center">
          <BackPill href={back.href} label={back.label} />
        </div>
      )}
      <div className={cn(!back && 'pr-14')}>
        {/* The eyebrow gets the full width so a dated one never wraps beside the actions. */}
        {eyebrow && <p className="eyebrow truncate">{eyebrow}</p>}
        <div className={cn('flex items-end gap-3', eyebrow ? 'mt-2' : 'min-h-[62px]')}>
          <h1 className="page-title min-w-0 flex-1">{title}</h1>
          {actions && <div className="flex shrink-0 items-end gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  );
}

const pillClass =
  'glass inline-flex h-11 shrink-0 items-center gap-0.5 rounded-[22px] pl-1.5 pr-3.5 text-[15px] font-semibold text-accent-ink transition-transform duration-150 ease-soft active:scale-[0.97] focus-visible:outline-none';

/** Glass back pill (CMP-4): chevron + the parent's name. A link or a button. */
export function BackPill({ label, href, onClick }: { label: string; href?: string; onClick?: () => void }) {
  const body = (
    <>
      <ChevronLeft width={22} height={22} aria-hidden />
      {label}
    </>
  );
  const aria = label === 'Back' ? 'Back' : `Back to ${label}`;
  return href ? (
    <Link href={href} replace className={pillClass} aria-label={aria}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={pillClass} aria-label={aria}>
      {body}
    </button>
  );
}

/** Glass link pill for an overlay's action slot ("YouTube ↗"). */
export function LinkPill({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="glass inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[22px] px-3.5 text-[15px] font-semibold text-ink-soft transition-transform duration-150 active:scale-[0.97]"
    >
      {children}
      <ExternalLink width={14} height={14} aria-hidden />
    </a>
  );
}

/** Eyebrow date, "Mon, Nov 2", for the Home header (Eastern calendar day). */
export function headerDate(now = new Date()) {
  return now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  });
}
