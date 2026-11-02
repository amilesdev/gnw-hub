'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from './Avatar';

/**
 * Floating avatar pinned to the top-right of the shell — the way into Profile
 * (members) or Settings (leaders), which aren't bottom tabs. It stays put while
 * the screen scrolls beneath it, so headers with right-side controls reserve
 * room for it with `pr-12`. Hidden on the destination itself.
 */
export function ProfileButton({ href, name, image }: { href: string; name: string; image: string | null }) {
  const pathname = usePathname();
  if (pathname === href || pathname.startsWith(`${href}/`)) return null;

  return (
    <Link
      href={href}
      aria-label={href.endsWith('settings') ? 'Settings' : 'Profile'}
      className="no-print row-press absolute right-5 z-30 rounded-full shadow-pop ring-2 ring-surface"
      style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}
    >
      <Avatar
        image={image}
        alt={name}
        className="grid h-10 w-10 place-items-center rounded-full font-display text-[17px] font-semibold text-white"
        style={{ background: 'linear-gradient(150deg, #5E7048, #3c4a2c)' }}
      >
        {name.slice(0, 1).toUpperCase()}
      </Avatar>
    </Link>
  );
}
