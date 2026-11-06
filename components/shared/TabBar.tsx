'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/utils';
import { memberTabs, leaderTabs } from './navConfig';
import { useChatUnreadTotal } from '@/components/chat/ChatProvider';

export type TabItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Match exactly (home roots) vs. prefix match (sections). */
  exact?: boolean;
  /** Other sections this tab stays lit on (Songs → Library, Suggestions). */
  also?: string[];
};

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function isActive(pathname: string, { href, exact, also }: TabItem) {
  if (exact) return pathname === href;
  return under(pathname, href) || (also ?? []).some((p) => under(pathname, p));
}

// The glass capsule (CMP-2). Icon components stay inside the client boundary —
// the server layout passes only a role string, never the function components
// themselves. The Crossover tab only shows in season (leaders from Sep 1,
// members from Oct 1).
export function TabBar({ variant, showCrossover }: { variant: 'member' | 'leader'; showCrossover: boolean }) {
  const tabs = variant === 'leader' ? leaderTabs : memberTabs;
  const items = showCrossover ? tabs : tabs.filter((t) => !t.href.endsWith('/crossover'));
  const pathname = usePathname();
  const chatUnread = useChatUnreadTotal();

  return (
    <nav
      aria-label="Main"
      className="tab-bar no-print pointer-events-auto px-3.5"
      // Floor the bottom padding to 28px (env is 0 without viewport-fit=cover);
      // the bar then sits at the safe-area bottom — same as GNW Roll Call.
      style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
    >
      <ul className="glass flex h-[68px] items-center rounded-dock px-1.5">
        {items.map((item) => {
          const { href, label, icon: Icon } = item;
          const active = isActive(pathname, item);
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                // Replace history instead of pushing so switching tabs never
                // stacks a back-entry — a native left-edge swipe then can't pop
                // one tab back to another. Every tab stays "stuck" like Home.
                replace
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-14 flex-col items-center justify-center gap-[3px] rounded-[28px] transition-transform duration-150 ease-soft active:scale-[0.94]',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/45',
                  active ? 'text-ink' : 'text-ink-soft',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'glass-thumb absolute inset-0 rounded-[28px] transition-opacity duration-200 ease-soft',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className={cn('relative', active && 'text-accent-ink')}>
                  <Icon width={22} height={22} />
                  {href.endsWith('/chat') && chatUnread > 0 && (
                    <span
                      className="absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-unread px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface"
                      aria-label={`${chatUnread} unread`}
                    >
                      {chatUnread > 99 ? '99+' : chatUnread}
                    </span>
                  )}
                </span>
                <span className={cn('relative max-w-full truncate px-0.5 text-[11px] leading-[13px]', active ? 'font-bold' : 'font-semibold')}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
