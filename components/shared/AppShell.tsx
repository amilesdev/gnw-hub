import type { ReactNode } from 'react';
import { TabBar } from './TabBar';
import { PollGate } from './PollGate';
import { AudioProvider } from './AudioProvider';
import { MiniPlayer } from './MiniPlayer';
import { MiniCallBar } from '@/components/call/MiniCallBar';
import { PushSubscriptionSync } from './PushSubscriptionSync';
import { ProfileButton } from './ProfileButton';

/**
 * Fixed, centered phone shell (max 430px) with a scrollable content area, a
 * pinned bottom tab bar, and the floating profile avatar. (Design system §11.)
 */
export function AppShell({
  children,
  variant,
  header,
  user,
}: {
  children: ReactNode;
  variant: 'member' | 'leader';
  header?: ReactNode;
  user: { name: string; image: string | null };
}) {
  return (
    <AudioProvider>
      <div className="app-shell">
        {header}
        <ProfileButton
          href={variant === 'leader' ? '/dashboard/settings' : '/home/profile'}
          name={user.name}
          image={user.image}
        />
        <main
          className="no-scrollbar flex-1 overflow-y-auto px-5 pb-6"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
        >
          {children}
        </main>
        <MiniCallBar />
        <MiniPlayer />
        <TabBar variant={variant} />
        <PollGate />
        <PushSubscriptionSync />
      </div>
    </AudioProvider>
  );
}
