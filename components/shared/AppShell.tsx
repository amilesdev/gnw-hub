import type { ReactNode } from 'react';
import { TabBar } from './TabBar';
import { PollGate } from './PollGate';
import { AudioProvider } from './AudioProvider';
import { MiniPlayer } from './MiniPlayer';
import { MiniCallBar } from '@/components/call/MiniCallBar';

/**
 * Fixed, centered phone shell (max 430px) with a scrollable content area and a
 * pinned bottom tab bar. (Design system §11.)
 */
export function AppShell({
  children,
  variant,
  header,
}: {
  children: ReactNode;
  variant: 'member' | 'leader';
  header?: ReactNode;
}) {
  return (
    <AudioProvider>
      <div className="app-shell">
        {header}
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
      </div>
    </AudioProvider>
  );
}
