'use client';

import '@livekit/components-styles';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { apiFetch } from '@/lib/api-client';

type TokenResponse = { token: string; serverUrl: string; name: string };

// Fetch a join token for this call, then hand off to LiveKit. The room media
// itself is all LiveKit's; we just manage the token handshake + connect/leave.
export function CallRoom({ callId }: { callId: string }) {
  const router = useRouter();
  const [conn, setConn] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<TokenResponse>(`/api/calls/${callId}/token`, { method: 'POST' })
      .then((res) => {
        if (!cancelled) setConn(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not join the call.');
      });
    return () => {
      cancelled = true;
    };
  }, [callId]);

  const leave = () => router.push('/');

  if (error) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-ink p-6 text-center text-white">
        <div className="space-y-4">
          <p className="text-lg font-semibold">{error}</p>
          <button type="button" onClick={leave} className="btn-primary">
            Back to Hub
          </button>
        </div>
      </div>
    );
  }

  if (!conn) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-ink text-white">
        <p className="animate-pulse text-sm font-semibold">Connecting…</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={conn.token}
      serverUrl={conn.serverUrl}
      connect
      audio
      video={false}
      data-lk-theme="default"
      style={{ height: '100dvh' }}
      onDisconnected={leave}
    >
      <CallStage />
      <RoomAudioRenderer />
      <ControlBar />
    </LiveKitRoom>
  );
}

// Video (or camera-off placeholder) tiles for everyone in the room, laid out in
// a responsive grid above the control bar.
function CallStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <GridLayout tracks={tracks} style={{ height: 'calc(100dvh - var(--lk-control-bar-height))' }}>
      <ParticipantTile />
    </GridLayout>
  );
}
