import type { ReactNode } from 'react';
import { TabBar } from './TabBar';
import { PollGate } from './PollGate';
import { AudioProvider } from './AudioProvider';
import { MiniPlayer } from './MiniPlayer';
import { MiniCallBar } from '@/components/call/MiniCallBar';
import { PushSubscriptionSync } from './PushSubscriptionSync';
import { ProfileButton } from './ProfileButton';
import { ChatProvider } from '@/components/chat/ChatProvider';
import { KeyboardWatcher } from './KeyboardWatcher';
import { DataSync } from './DataSync';
import { HomeHint } from './HomeHint';

/**
 * Fixed, centered phone shell (max 430px) with a scrollable content area, a
 * pinned bottom tab bar, and the floating profile avatar. (Design system §11.)
 */
export function AppShell({
  children,
  variant,
  header,
  user,
  showCrossover,
  chatTopic,
}: {
  children: ReactNode;
  variant: 'member' | 'leader';
  header?: ReactNode;
  user: { name: string; image: string | null };
  /** Whether the Crossover tab is in season for this viewer (lib/crossover-season). */
  showCrossover: boolean;
  /**
   * This user's private chat-ping topic (lib/chat/realtime-server → chatUserTopic),
   * or null when they can't use chat yet (lib/access → canUseChat): no
   * subscription, no unread fetches, no badge.
   */
  chatTopic: string | null;
}) {
  const shell = (
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
        <TabBar variant={variant} showCrossover={showCrossover} />
        <PollGate />
        <PushSubscriptionSync />
        <KeyboardWatcher />
        <DataSync />
        <HomeHint home={variant === 'leader' ? '/dashboard' : '/home'} />
      </div>
    </AudioProvider>
  );
  return chatTopic ? <ChatProvider topic={chatTopic}>{shell}</ChatProvider> : shell;
}
