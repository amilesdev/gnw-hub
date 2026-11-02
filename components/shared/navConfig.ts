import { Home, Calendar, Music, MessageCircle, Crossover, PlayRings } from './Icons';
import type { TabItem } from './TabBar';
import { PLAY_ENABLED } from '@/lib/play/flag';

// Bottom nav. Chat sits in the middle; "Songs" is the setlist screen
// (Suggestions live inside its Song Library); Crossover is last. Profile
// (members) / Settings (leaders) aren't tabs — they're the floating avatar
// (ProfileButton). Play is the immersive game route group (its own shells).
export const memberTabs: TabItem[] = [
  { href: '/home', label: 'Home', icon: Home, exact: true },
  { href: '/home/events', label: 'Events', icon: Calendar },
  { href: '/home/chat', label: 'Chat', icon: MessageCircle },
  { href: '/home/setlist', label: 'Songs', icon: Music },
  ...(PLAY_ENABLED ? [{ href: '/play', label: 'Play', icon: PlayRings }] : []),
  { href: '/home/crossover', label: 'Crossover', icon: Crossover },
];

export const leaderTabs: TabItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home, exact: true },
  { href: '/dashboard/events', label: 'Events', icon: Calendar },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageCircle },
  { href: '/dashboard/setlist', label: 'Songs', icon: Music },
  ...(PLAY_ENABLED ? [{ href: '/play', label: 'Play', icon: PlayRings }] : []),
  { href: '/dashboard/crossover', label: 'Crossover', icon: Crossover },
];
