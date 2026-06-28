import { notFound } from 'next/navigation';
import { PLAY_ENABLED } from '@/lib/play/flag';

// Gate the whole /play route group behind the feature flag. When Play is
// disabled this 404s every Play screen, covering direct navigation / stale
// links even though the tab is already hidden. API routes are intentionally
// left reachable (soft, UI-only disable).
export default function PlayLayout({ children }: { children: React.ReactNode }) {
  if (!PLAY_ENABLED) notFound();
  return children;
}
