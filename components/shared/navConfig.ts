import { Home, Calendar, Music, UserIcon, Settings } from './Icons';
import type { TabItem } from './TabBar';

// Member bottom nav (4 items).
export const memberTabs: TabItem[] = [
  { href: '/home', label: 'Home', icon: Home, exact: true },
  { href: '/home/events', label: 'Events', icon: Calendar },
  { href: '/home/setlist', label: 'Setlist', icon: Music },
  { href: '/home/profile', label: 'Profile', icon: UserIcon },
];

// Leader bottom nav (4 items) — Profile + Members consolidated into Settings.
export const leaderTabs: TabItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home, exact: true },
  { href: '/dashboard/events', label: 'Events', icon: Calendar },
  { href: '/dashboard/setlist', label: 'Setlist', icon: Music },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];
