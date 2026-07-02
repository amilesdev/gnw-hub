'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { Phone, X } from '@/components/shared/Icons';
import { useCall } from './CallProvider';

type ActiveCall = { id: string; name: string; participants: number };

/**
 * Home-screen "there's a call happening" prompt. A member who misses (or never
 * sees) the push notification still has a way in: this polls for a live call and
 * pops up a prominent Join card with the call name and how many are on it. Hidden
 * while you're already on that call — the MiniCallBar / call screen take over.
 */
export function ActiveCallBanner() {
  const router = useRouter();
  const { callId, status } = useCall();
  const [active, setActive] = useState<ActiveCall | null>(null);
  // Remember the call the user chose to dismiss so it doesn't nag on every poll;
  // a *different* (newer) call still pops up.
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { calls } = await apiFetch<{ calls: ActiveCall[] }>('/api/calls/active');
        if (alive) setActive(calls[0] ?? null);
      } catch {
        // Offline / transient — keep whatever we last showed.
      }
    };
    void load();
    const timer = setInterval(load, 10000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!active) return null;
  if (dismissedId === active.id) return null;
  // Already on this call — no need to advertise it.
  if (callId === active.id && (status === 'connected' || status === 'connecting')) return null;

  const count = active.participants;

  return (
    <div className="animate-rise overflow-hidden rounded-3xl border border-accent/25 bg-accent-soft shadow-card">
      <div className="flex items-center gap-3 p-3">
        <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-white shadow-pop">
          <span
            className="absolute inset-0 rounded-full ring-2 ring-accent animate-pulse-ring"
            aria-hidden
          />
          <Phone width={22} height={22} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-good animate-pulse" aria-hidden />
            <span className="eyebrow text-accent dark:text-accent-on">Live call</span>
          </div>
          <p className="truncate text-[15px] font-bold text-ink">{active.name}</p>
          <p className="text-xs font-semibold text-ink-soft">
            {count} {count === 1 ? 'person' : 'people'} on the call
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push(`/call/${active.id}`)}
          className="btn-primary shrink-0 px-5 py-2.5"
        >
          Join
        </button>

        <button
          type="button"
          onClick={() => setDismissedId(active.id)}
          aria-label="Dismiss"
          className="row-press -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint"
        >
          <X width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
