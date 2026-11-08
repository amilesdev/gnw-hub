import { Home, Calendar, Music, MessageCircle, Crossover } from './Icons';
import type { TabItem } from './TabBar';

// Bottom nav (CMP-2). Chat is 3rd; "Songs" is Setlists | Library (Suggestions
// live inside the Library, so Songs stays lit there); Crossover is last.
// Profile (members) / Settings (leaders) aren't tabs — they're the floating
// avatar (ProfileButton).
export const memberTabs: TabItem[] = [
  { href: '/home', label: 'Home', icon: Home, exact: true },
  { href: '/home/events', label: 'Events', icon: Calendar },
  { href: '/home/chat', label: 'Chat', icon: MessageCircle },
  { href: '/home/setlist', label: 'Songs', icon: Music, also: ['/home/library', '/home/suggestions'] },
  { href: '/home/crossover', label: 'Crossover', icon: Crossover },
];

export const leaderTabs: TabItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home, exact: true },
  { href: '/dashboard/events', label: 'Events', icon: Calendar, also: ['/dashboard/availability/team'] },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageCircle },
  { href: '/dashboard/setlist', label: 'Songs', icon: Music, also: ['/dashboard/library', '/dashboard/suggestions'] },
  { href: '/dashboard/crossover', label: 'Crossover', icon: Crossover },
];
