'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { PlayRings } from '@/components/shared/Icons';
import { usePlayActive } from '@/lib/play/use-play-active';

export function GuestJoin({
  token,
  state,
}: {
  token: string;
  state: 'open' | 'started' | 'invalid';
}) {
  usePlayActive();
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { sessionId } = await apiFetch<{ sessionId: string }>('/api/play/guest-join', {
        method: 'POST',
        body: JSON.stringify({ token, name: name.trim() }),
      });
      router.push(`/play/session/${sessionId}/lobby`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join');
      setBusy(false);
    }
  };

  return (
    <div className="app-shell play-surface items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div
          className="play-core-breathe mx-auto grid h-20 w-20 place-items-center rounded-full text-white shadow-pop"
          style={{ background: 'radial-gradient(120% 120% at 30% 25%, rgb(var(--play-green)), #157a43)' }}
        >
          <PlayRings width={36} height={36} />
        </div>
        <div>
          <div className="eyebrow">GNW Play</div>
          <h1 className="page-title mt-2">You&apos;re invited to play</h1>
        </div>

        {state === 'invalid' && (
          <div className="card p-6 text-ink-soft">This invite link isn&apos;t valid.</div>
        )}
        {state === 'started' && (
          <div className="card p-6 text-ink-soft">This game has already started. Ask the host for a new link.</div>
        )}
        {state === 'open' && (
          <div className="space-y-3">
            <input
              autoFocus
              className="field text-center"
              placeholder="Enter your name"
              value={name}
              maxLength={40}
              autoComplete="name"
              enterKeyHint="go"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && join()}
            />
            {error && <p className="text-sm font-medium text-bad">{error}</p>}
            <button
              type="button"
              onClick={join}
              disabled={!name.trim() || busy}
              className="btn-primary w-full disabled:opacity-50"
            >
              Join Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
