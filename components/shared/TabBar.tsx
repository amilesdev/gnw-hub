'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/utils';
import { memberTabs, leaderTabs } from './navConfig';

export type TabItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Match exactly (home roots) vs. prefix match (sections). */
  exact?: boolean;
};

// Icon components stay inside the client boundary — the server layout passes
// only a role string, never the function components themselves.
export function TabBar({ variant }: { variant: 'member' | 'leader' }) {
  const items = variant === 'leader' ? leaderTabs : memberTabs;
  const pathname = usePathname();

  return (
    <nav
      className="no-print shrink-0 border-t border-line bg-app/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-stretch justify-around px-2 py-2">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  'row-press flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5',
                  active ? 'text-accent' : 'text-ink-faint',
                )}
              >
                <Icon width={23} height={23} />
                <span className={cn('text-[11px]', active ? 'font-bold' : 'font-semibold')}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
