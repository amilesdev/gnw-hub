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
import { ToastProvider } from './Toast';
import { SongSheetProvider } from './SongSheetHost';
import { Dock, DockToasts, ShellBackdrop } from './Dock';

/**
 * Fixed, centered phone shell (CMP-1, max 430px). The ambient glow sits behind
 * a scrolling `<main>`; the dock (call bar, MiniPlayer, glass tab bar) floats
 * over the bottom of it, and the floating profile avatar over the top right.
 * Only `<main>` scrolls, so the tab bar stays pinned.
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
      <ToastProvider>
        <SongSheetProvider>
          <div className="app-shell">
            <ShellBackdrop />
            {header}
            <ProfileButton
              href={variant === 'leader' ? '/dashboard/settings' : '/home/profile'}
              name={user.name}
              image={user.image}
            />
            <main
              className="no-scrollbar relative z-[1] flex-1 overflow-y-auto px-5"
              style={{
                paddingTop: 'calc(env(safe-area-inset-top) + 16px)',
                paddingBottom: 'calc(var(--dock-h, 96px) + 24px)',
              }}
            >
              {children}
            </main>
            <Dock>
              <MiniCallBar />
              <MiniPlayer />
              <TabBar variant={variant} showCrossover={showCrossover} />
            </Dock>
            <DockToasts />
            <PollGate />
            <PushSubscriptionSync />
            <KeyboardWatcher />
            <DataSync />
            <HomeHint home={variant === 'leader' ? '/dashboard' : '/home'} />
          </div>
        </SongSheetProvider>
      </ToastProvider>
    </AudioProvider>
  );
  return chatTopic ? <ChatProvider topic={chatTopic}>{shell}</ChatProvider> : shell;
}
