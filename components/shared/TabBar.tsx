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
};

// Icon components stay inside the client boundary — the server layout passes
// only a role string, never the function components themselves. The Crossover
// tab only shows in season (leaders from Sep 1, members from Oct 1).
export function TabBar({ variant, showCrossover }: { variant: 'member' | 'leader'; showCrossover: boolean }) {
  const tabs = variant === 'leader' ? leaderTabs : memberTabs;
  const items = showCrossover ? tabs : tabs.filter((t) => !t.href.endsWith('/crossover'));
  const pathname = usePathname();
  const chatUnread = useChatUnreadTotal();

  return (
    <nav
      className="no-print shrink-0 border-t border-line bg-app/95 backdrop-blur"
      // Floor the bottom padding to 1.75rem (env is 0 without viewport-fit=cover);
      // the bar then sits flush at the safe-area bottom — same as GNW Roll Call.
      style={{ paddingBottom: 'max(1.75rem, env(safe-area-inset-bottom))' }}
    >
      <ul className="flex items-stretch justify-around px-2 py-2">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                // Replace history instead of pushing so switching tabs never
                // stacks a back-entry — a native left-edge swipe then can't pop
                // one tab back to another. Every tab stays "stuck" like Home.
                replace
                className={cn(
                  'row-press flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5',
                  active ? 'text-accent dark:text-accent-on' : 'text-ink-faint',
                )}
              >
                <span className="relative">
                  <Icon width={23} height={23} />
                  {href.endsWith('/chat') && chatUnread > 0 && (
                    <span
                      className="absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-unread px-1 text-[10px] font-bold leading-none text-white ring-2 ring-app"
                      aria-label={`${chatUnread} unread`}
                    >
                      {chatUnread > 99 ? '99+' : chatUnread}
                    </span>
                  )}
                </span>
                <span className={cn('text-[11px]', active ? 'font-bold' : 'font-semibold')}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
