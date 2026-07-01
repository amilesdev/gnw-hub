'use client';

import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Phone } from '@/components/shared/Icons';
import { useCall, useElapsed, formatElapsed } from './CallProvider';

/**
 * Persistent call transport. Sits above the tab bar whenever a call is live and
 * the full call screen isn't open — so a member keeps talking while they browse
 * the Hub, and taps the bar to return. Mirrors the audio MiniPlayer. Leaving the
 * call stays deliberate: hang-up lives only on the full screen, not here.
 */
export function MiniCallBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { callId, callName, status, muted, connectedAt, toggleMute } = useCall();
  const elapsed = useElapsed(connectedAt);

  const live = status === 'connected' || status === 'connecting';
  if (!callId || !live) return null;
  // The full call screen is already the transport when it's open.
  if (pathname.startsWith('/call/')) return null;

  return (
    <div className="no-print shrink-0 px-3 pb-1 pt-2">
      <div className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent-soft px-3 py-2 shadow-card">
        <button
          type="button"
          onClick={() => router.push(`/call/${callId}`)}
          className="row-press flex min-w-0 flex-1 items-center gap-3 rounded-xl py-0.5 text-left"
          aria-label={`Return to ${callName ?? 'the call'}`}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white shadow-pop">
            <Phone width={17} height={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-good animate-pulse" aria-hidden />
              <span className="truncate text-sm font-semibold text-ink">
                {callName ?? 'On a call'}
              </span>
            </span>
            <span className="block text-xs font-semibold tabular-nums text-ink-soft">
              {status === 'connected' ? `${formatElapsed(elapsed)} · Tap to return` : 'Joining…'}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={toggleMute}
          disabled={status !== 'connected'}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-95 disabled:opacity-40',
            muted ? 'bg-ink text-app' : 'border border-line bg-surface text-ink',
          )}
        >
          {muted ? <MicOff width={18} height={18} /> : <Mic width={18} height={18} />}
        </button>
      </div>
    </div>
  );
}
