'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MemberAvatar } from './Avatar';

/**
 * Floating avatar (CMP-21): a 44px glass droplet pinned top-right of the shell,
 * the way into Profile (members) or Settings (leaders), which aren't tabs. It
 * stays put while the screen scrolls beneath it, so every header reserves 56px
 * on the right (ScreenHeader). Hidden on Profile/Settings and My Availability
 * (reached from Profile).
 */
export function ProfileButton({ href, name, image }: { href: string; name: string; image: string | null }) {
  const pathname = usePathname();
  const base = href.startsWith('/dashboard') ? '/dashboard' : '/home';
  const ownAvailability = pathname === `${base}/availability`;
  if (pathname === href || pathname.startsWith(`${href}/`) || ownAvailability) return null;

  return (
    <Link
      href={href}
      aria-label={href.endsWith('settings') ? 'Settings' : 'Profile'}
      className="no-print absolute right-5 z-avatar rounded-full transition-transform duration-150 ease-soft active:scale-[0.94] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
      style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
    >
      <MemberAvatar
        name={name}
        image={image}
        size={44}
        variant="drop"
        className={image ? 'border border-[var(--drop-border)]' : undefined}
      />
    </Link>
  );
}
