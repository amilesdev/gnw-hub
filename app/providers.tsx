'use client';

import { SessionProvider } from 'next-auth/react';
import { CallProvider } from '@/components/call/CallProvider';
import { ThemeProvider } from '@/components/shared/ThemeProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  // CallProvider sits above the router so a call survives navigation — leaving
  // the call screen keeps the room (and its audio) live under the MiniCallBar.
  return (
    <SessionProvider>
      <ThemeProvider>
        <CallProvider>{children}</CallProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
