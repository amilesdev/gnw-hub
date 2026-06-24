import type { ReactNode } from 'react';
import { TabBar } from './TabBar';

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
    <div className="app-shell">
      {header}
      <main
        className="no-scrollbar flex-1 overflow-y-auto px-5 pb-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        {children}
      </main>
      <TabBar variant={variant} />
    </div>
  );
}
