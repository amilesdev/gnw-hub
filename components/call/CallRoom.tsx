'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  useTracks,
  VideoTrack,
  isTrackReference,
  type TrackReference,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Video, VideoOff, PhoneOff, ChevronDown, Maximize, X } from '@/components/shared/Icons';
import {
  useCall,
  useCallParticipants,
  useElapsed,
  formatElapsed,
  type CallParticipant,
} from './CallProvider';

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// The full-screen call. It's a *view* onto the app-wide room in CallProvider —
// mounting it joins the call; minimizing just leaves the screen (the room, and
// the audio, stay live via the MiniCallBar). Only "Leave" actually hangs up.
// Voice-first: everyone shows as an avatar tile, and a tile fills with live
// video the moment that person turns their camera on.
export function CallRoom({ callId }: { callId: string }) {
  const router = useRouter();
  const { callName, status, error, muted, cameraOn, callStartedAt, join, leave, toggleMute, toggleCamera, stopCamera } =
    useCall();
  const participants = useCallParticipants();
  // One camera track reference per participant (placeholder when their camera is
  // off), so the grid always has a tile for everyone.
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  });
  const elapsed = useElapsed(callStartedAt);

  // Which participant is enlarged (Zoom-style), if any. Only camera-on tiles can
  // be spotlighted; if that person's video ends, the overlay closes itself.
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const spotlightRef = spotlightId
    ? cameraTracks.find(
        (r) => r.participant.identity === spotlightId && isTrackReference(r) && !r.publication.isMuted,
      )
    : undefined;
  useEffect(() => {
    if (spotlightId && !spotlightRef) setSpotlightId(null);
  }, [spotlightId, spotlightRef]);

  useEffect(() => {
    join(callId);
  }, [callId, join]);

  // Leaving the call *screen* (minimize, back, or navigating away) should stop
  // broadcasting video immediately — the call stays live under the MiniCallBar,
  // but there's no camera control there, so we never leave it running unseen.
  useEffect(() => stopCamera, [stopCamera]);

  const minimize = () => router.push('/');
  const hangUp = async () => {
    await leave();
    router.push('/');
  };

  if (status === 'error') {
    return (
      <CallShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <p className="max-w-xs text-lg font-semibold text-ink">
            {error ?? 'Could not join the call.'}
          </p>
          <button type="button" onClick={() => router.push('/')} className="btn-primary">
            Back to Hub
          </button>
        </div>
      </CallShell>
    );
  }

  const connected = status === 'connected';
  const metaById = new Map(participants.map((p) => [p.id, p]));
  const count = cameraTracks.length;

  return (
    <CallShell>
      <header className="flex items-start gap-2 pt-1">
        <button
          type="button"
          onClick={minimize}
          aria-label="Minimize — stay on the call"
          className="row-press -ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-soft"
        >
          <ChevronDown width={26} height={26} />
        </button>
        <div className="min-w-0 flex-1 pt-1 text-center">
          <h1 className="page-title truncate">{callName ?? 'Call'}</h1>
          <p className="eyebrow mt-1.5 flex items-center justify-center gap-1.5 tabular-nums">
            {connected ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden />
                {formatElapsed(elapsed)} · {count} {count === 1 ? 'person' : 'people'}
              </>
            ) : (
              'Joining…'
            )}
          </p>
        </div>
        {/* Balances the minimize button so the title stays centered. */}
        <div className="h-11 w-11 shrink-0" aria-hidden />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center py-6">
        {connected ? (
          <div
            className={cn(
              'grid w-full max-w-sm gap-3',
              count <= 1 ? 'grid-cols-1' : 'grid-cols-2',
            )}
          >
            {cameraTracks.map((ref) => {
              const hasVideo = isTrackReference(ref) && !ref.publication.isMuted;
              return (
                <ParticipantTile
                  key={ref.participant.identity}
                  trackRef={ref}
                  meta={metaById.get(ref.participant.identity)}
                  solo={count <= 1}
                  onOpen={hasVideo ? () => setSpotlightId(ref.participant.identity) : undefined}
                />
              );
            })}
          </div>
        ) : (
          <div
            className="h-24 w-24 rounded-full bg-accent-soft animate-breathe grain-block"
            aria-hidden
          />
        )}
      </div>

      <div className="flex items-start justify-center gap-5 pt-2">
        <ControlButton
          onClick={toggleMute}
          disabled={!connected}
          label={muted ? 'Unmute' : 'Mute'}
          tone={muted ? 'active' : 'neutral'}
        >
          {muted ? <MicOff width={25} height={25} /> : <Mic width={25} height={25} />}
        </ControlButton>
        <ControlButton
          onClick={toggleCamera}
          disabled={!connected}
          label={cameraOn ? 'Stop video' : 'Start video'}
          tone={cameraOn ? 'active' : 'neutral'}
        >
          {cameraOn ? <Video width={25} height={25} /> : <VideoOff width={25} height={25} />}
        </ControlButton>
        <ControlButton onClick={hangUp} label="Leave" tone="danger">
          <PhoneOff width={25} height={25} />
        </ControlButton>
      </div>

      {spotlightRef && isTrackReference(spotlightRef) && (
        <SpotlightOverlay
          trackRef={spotlightRef}
          meta={metaById.get(spotlightRef.participant.identity)}
          onClose={() => setSpotlightId(null)}
        />
      )}
    </CallShell>
  );
}

// Centered phone-width surface with safe-area padding — its own shell, since the
// call screen renders outside the tabbed AppShell.
function CallShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-center bg-app">
      <div
        className="flex w-full max-w-[430px] flex-col px-5"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1.75rem, env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// A participant tile. Fills with live video when their camera is on; otherwise a
// calm avatar. The signature moment carries over: a sage ring (and haloed avatar)
// blooms around whoever is speaking, so the room feels present with or without video.
function ParticipantTile({
  trackRef,
  meta,
  solo,
  onOpen,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  meta: CallParticipant | undefined;
  solo: boolean;
  /** Tap-to-enlarge. Present only when this tile is showing live video. */
  onOpen?: () => void;
}) {
  const participant = trackRef.participant;
  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted;
  const name = meta?.name ?? participant.name ?? 'Member';
  const isLocal = meta?.isLocal ?? participant.isLocal;
  const speaking = meta?.isSpeaking ?? false;
  const micOn = meta?.micOn ?? true;

  return (
    <div
      className={cn(
        // transform-gpu forces the rounded corners to clip the <video> on iOS
        // Safari, where overflow-hidden alone leaves square corners.
        'grain-block relative transform-gpu overflow-hidden rounded-3xl bg-accent-soft transition-shadow',
        solo ? 'aspect-[4/5]' : 'aspect-square',
        speaking ? 'ring-4 ring-accent' : 'ring-1 ring-line',
      )}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          // rounded-[inherit] + its own GPU layer make the <video> clip to the
          // tile's corners on iOS Safari, where overflow-hidden on the parent
          // alone leaves remote video square (only the flipped local tile clipped).
          className={cn(
            'h-full w-full rounded-[inherit] object-cover transform-gpu',
            isLocal && 'scale-x-[-1]',
          )}
        />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <div className="relative grid h-20 w-20 place-items-center">
            {speaking && (
              <span
                className="absolute inset-0 rounded-full ring-2 ring-accent animate-pulse-ring"
                aria-hidden
              />
            )}
            <div className="grid h-20 w-20 place-items-center rounded-full bg-accent text-2xl font-bold text-white shadow-pop">
              {initials(name)}
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/50 to-transparent px-3 pb-2 pt-7">
        {!micOn && <MicOff width={14} height={14} className="shrink-0 text-white" aria-hidden />}
        <span className="truncate text-sm font-semibold text-white">{isLocal ? 'You' : name}</span>
      </div>

      {/* Tap-to-enlarge — only when this tile is live video. Covers the tile so a
          tap anywhere opens the spotlight; a corner glyph hints it's tappable. */}
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Enlarge ${isLocal ? 'your' : `${name}'s`} video`}
          className="absolute inset-0 grid place-items-start justify-end p-2 transition active:bg-black/10"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
            <Maximize width={15} height={15} />
          </span>
        </button>
      )}
    </div>
  );
}

// The Zoom-style enlarged view: a centered card that covers most of the screen
// with one person's live video, dimming the call behind it. Tap the backdrop,
// the close button, or Escape to return to the grid.
function SpotlightOverlay({
  trackRef,
  meta,
  onClose,
}: {
  trackRef: TrackReference;
  meta: CallParticipant | undefined;
  onClose: () => void;
}) {
  const participant = trackRef.participant;
  const name = meta?.name ?? participant.name ?? 'Member';
  const isLocal = meta?.isLocal ?? participant.isLocal;
  const micOn = meta?.micOn ?? true;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="grain-block relative h-[78vh] w-[86%] max-w-[560px] transform-gpu overflow-hidden rounded-3xl bg-accent-soft shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <VideoTrack
          trackRef={trackRef}
          className={cn(
            'h-full w-full rounded-[inherit] object-cover transform-gpu',
            isLocal && 'scale-x-[-1]',
          )}
        />

        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/55 to-transparent px-4 pb-3 pt-9">
          {!micOn && <MicOff width={16} height={16} className="shrink-0 text-white" aria-hidden />}
          <span className="truncate text-base font-semibold text-white">
            {isLocal ? 'You' : name}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close enlarged video"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition active:scale-95"
        >
          <X width={18} height={18} />
        </button>
      </div>
    </div>
  );
}

function ControlButton({
  children,
  label,
  tone,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label: string;
  tone: 'neutral' | 'active' | 'danger';
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          'grid h-16 w-16 place-items-center rounded-full transition active:scale-95 disabled:opacity-40 disabled:active:scale-100',
          tone === 'danger' && 'bg-bad text-white shadow-pop',
          tone === 'active' && 'bg-ink text-app',
          tone === 'neutral' && 'border border-line bg-surface text-ink shadow-card',
        )}
      >
        {children}
      </button>
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
    </div>
  );
}
