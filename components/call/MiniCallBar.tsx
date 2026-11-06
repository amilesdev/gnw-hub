'use client';

import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Phone } from '@/components/shared/Icons';
import { useCall, useElapsed, formatElapsed } from './CallProvider';

/**
 * Persistent call transport (CL-2): a glass bar at the top of the dock whenever
 * a call is live and the full call screen isn't open — so a member keeps
 * talking while they browse the Hub, and taps the bar to return. Mirrors the
 * audio MiniPlayer. Leaving the call stays deliberate: hang-up lives only on
 * the full screen, not here.
 */
export function MiniCallBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { callId, callName, status, muted, callStartedAt, toggleMute } = useCall();
  const elapsed = useElapsed(callStartedAt);

  const live = status === 'connected' || status === 'connecting';
  if (!callId || !live) return null;
  // The full call screen is already the transport when it's open.
  if (pathname.startsWith('/call/')) return null;

  return (
    <div className="no-print pointer-events-auto mx-3.5">
      <div className="glass flex items-center gap-3 rounded-[30px] py-[7px] pl-[7px] pr-1">
        <button
          type="button"
          onClick={() => router.push(`/call/${callId}`)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition-transform duration-150 active:scale-[0.98]"
          aria-label={`Return to ${callName ?? 'the call'}`}
        >
          <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-accent text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.55)]">
            <Phone width={18} height={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-good" aria-hidden />
              <span className="truncate text-[15px] font-semibold leading-5 text-ink">{callName ?? 'On a call'}</span>
            </span>
            <span className="block text-[13px] leading-[18px] tabular-nums text-ink-soft">
              {status === 'connected' ? `${formatElapsed(elapsed)} · Tap to return` : 'Joining…'}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={toggleMute}
          disabled={status !== 'connected'}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className={cn('btn-icon', muted && 'bg-ink text-app')}
        >
          {muted ? <MicOff width={20} height={20} /> : <Mic width={20} height={20} />}
        </button>
      </div>
    </div>
  );
}
