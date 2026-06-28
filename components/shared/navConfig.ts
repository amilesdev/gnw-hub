import { Home, Calendar, Music, UserIcon, PlayRings } from './Icons';
import type { TabItem } from './TabBar';
import { PLAY_ENABLED } from '@/lib/play/flag';

// Member bottom nav. Play is the immersive game route group (its own shells).
export const memberTabs: TabItem[] = [
  { href: '/home', label: 'Home', icon: Home, exact: true },
  { href: '/home/events', label: 'Events', icon: Calendar },
  { href: '/home/setlist', label: 'Setlist', icon: Music },
  ...(PLAY_ENABLED ? [{ href: '/play', label: 'Play', icon: PlayRings }] : []),
  { href: '/home/profile', label: 'Profile', icon: UserIcon },
];

// Leader bottom nav — Profile + Members consolidated into Settings.
export const leaderTabs: TabItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home, exact: true },
  { href: '/dashboard/events', label: 'Events', icon: Calendar },
  { href: '/dashboard/setlist', label: 'Setlist', icon: Music },
  ...(PLAY_ENABLED ? [{ href: '/play', label: 'Play', icon: PlayRings }] : []),
  { href: '/dashboard/settings', label: 'Settings', icon: UserIcon },
];
