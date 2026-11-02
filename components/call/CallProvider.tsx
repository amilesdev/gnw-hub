'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Room, RoomEvent, ConnectionState, DisconnectReason, Track } from 'livekit-client';
import { RoomContext, RoomAudioRenderer, useMaybeRoomContext } from '@livekit/components-react';
import { apiFetch } from '@/lib/api-client';

// A single, app-wide LiveKit room that outlives the call screen. The room lives
// here — above the router — so a member can leave the call screen and keep
// scrolling the Hub while still connected, exactly like the audio MiniPlayer.
// The full call screen and the MiniCallBar are just two views onto this one room.

type TokenResponse = { token: string; serverUrl: string; name: string; startedAt: string };

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'error';

// An in-call chat message. Lives only in memory for the duration of the call
// (Zoom-style): it's sent over the LiveKit data channel, never touches the
// server or database, and is wiped the moment the call ends.
export type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  isLocal: boolean;
  at: number;
};

// The LiveKit data-channel topic in-call chat rides on, kept separate from any
// other data traffic on the room.
const CHAT_TOPIC = 'chat';
// How many times we'll try to hand the mic back after the OS took it away
// before admitting defeat and showing the user as muted.
const MIC_RESTORE_ATTEMPTS = 3;
// Disconnects that mean "you're really out" — you hung up, the call was ended,
// you were removed, or you joined from another device. Anything else (iOS
// suspending the app, the signal socket dying, a server blip) gets an automatic
// rejoin instead of silently dropping the person from the call.
const FINAL_DISCONNECTS = new Set<DisconnectReason | undefined>([
  DisconnectReason.CLIENT_INITIATED,
  DisconnectReason.DUPLICATE_IDENTITY,
  DisconnectReason.PARTICIPANT_REMOVED,
  DisconnectReason.ROOM_DELETED,
  DisconnectReason.ROOM_CLOSED,
  DisconnectReason.USER_REJECTED,
]);
const chatEncoder = new TextEncoder();
const chatDecoder = new TextDecoder();

type CallContextValue = {
  callId: string | null;
  callName: string | null;
  status: CallStatus;
  error: string | null;
  muted: boolean;
  /** Whether the local camera is publishing. Off by default — video is opt-in. */
  cameraOn: boolean;
  /** Epoch ms when *this participant* connected. */
  connectedAt: number | null;
  /** Epoch ms when the leader started the call — drives the shared "total call
   *  time" timer, so everyone sees the same elapsed clock. */
  callStartedAt: number | null;
  /** Join a call (or return to the one already in progress). */
  join: (callId: string) => void;
  /** Hang up: disconnect and clear. */
  leave: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  /** Turn the local camera off if it's on. No-op otherwise. Used when leaving
   *  the call screen so video never keeps broadcasting from the background. */
  stopCamera: () => void;
  /** In-call chat, oldest first. Ephemeral: cleared when the call ends. */
  messages: ChatMessage[];
  /** Broadcast a chat message to everyone in the call. Trims/ignores blanks. */
  sendChat: (text: string) => void;
  /** Messages from other people that haven't been seen yet. Lives here (not in
   *  the call screen) so it survives minimizing back to the Hub. */
  unreadChat: number;
  /** Mark everything currently in `messages` as seen. */
  markChatRead: () => void;
};

const CallCtx = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const ctx = useContext(CallCtx);
  if (!ctx) throw new Error('useCall must be used within a CallProvider');
  return ctx;
}

// Create the Room once, on the client only (SSR-safe: null on the server).
function createRoom(): Room | null {
  if (typeof window === 'undefined') return null;
  return new Room({
    adaptiveStream: false,
    dynacast: false,
    // iOS fires `pagehide`/`freeze` when you swipe out of the app or pull the
    // notification shade — with the default (true) LiveKit tears the room down
    // there, which is exactly the backgrounding we want the call to survive.
    // The provider still disconnects explicitly on leave/unmount.
    disconnectOnPageLeave: false,
  });
}

/** True while the page is actually on screen. Server-safe. */
function pageVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

export function CallProvider({ children }: { children: ReactNode }) {
  const [room] = useState<Room | null>(createRoom);
  const [callId, setCallId] = useState<string | null>(null);
  const [callName, setCallName] = useState<string | null>(null);
  const [status, setStatus] = useState<CallStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // How many messages have been seen. Kept here rather than in the call screen so
  // the unread dot survives minimizing to the Hub and coming back.
  const [seenCount, setSeenCount] = useState(0);

  // Which call we're currently joining. A slow token fetch for an abandoned join
  // must not connect us to a call we've since left.
  const joiningRef = useRef<string | null>(null);
  // What the *user* wants their mic to be. iOS mutes — and sometimes ends — the
  // mic track whenever the app goes to the background (swipe out, notification
  // shade, screen lock). Adopting that as "the user muted themselves" is what made
  // people come back silently muted, so intent is tracked separately and the real
  // track is quietly reconciled to it once we're back on screen.
  const micIntentRef = useRef(true);
  // Guards against stacking / looping restore attempts, which is what churns the
  // iOS audio session (and makes it chirp) on every app switch.
  const restoringRef = useRef(false);
  const restoreAttemptsRef = useRef(0);
  // The call we got dropped from and still owe a rejoin. Held until the page is
  // back on screen — iOS won't hand a hidden page the mic or a stable socket.
  const pendingRejoinRef = useRef<string | null>(null);
  // Mirror latest state into refs so the callbacks below can stay identity-stable
  // (empty-ish deps) — consumers that call join() in an effect won't thrash.
  const callIdRef = useRef(callId);
  callIdRef.current = callId;
  const statusRef = useRef(status);
  statusRef.current = status;

  const resetToIdle = useCallback(() => {
    joiningRef.current = null;
    pendingRejoinRef.current = null;
    micIntentRef.current = true;
    restoreAttemptsRef.current = 0;
    setCallId(null);
    setCallName(null);
    setStatus('idle');
    setError(null);
    setConnectedAt(null);
    setCallStartedAt(null);
    setMuted(false);
    setCameraOn(false);
    setMessages([]);
    setSeenCount(0);
  }, []);

  // Put the real mic track back in step with what the user asked for.
  //
  // In the background we only take the cheap path: when iOS cuts the mic out
  // from under a backgrounded call, LiveKit tries to re-grab it, fails, and
  // *mutes the user itself* — but the capture is often still live (hence the
  // red "recording" pill). Unmuting a live capture just re-enables the track: no
  // getUserMedia, no audio-session restart, no chirp. Anything that needs a
  // fresh mic (the capture actually ended) waits until we're back on screen,
  // since touching the mic hardware in the background is what makes iOS chirp.
  const reconcileMic = useCallback(() => {
    if (!room || statusRef.current !== 'connected') return;
    if (restoringRef.current) return;
    const want = micIntentRef.current;
    if (room.localParticipant.isMicrophoneEnabled === want) {
      restoreAttemptsRef.current = 0;
      return;
    }
    if (!pageVisible()) {
      const capture = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track
        ?.mediaStreamTrack;
      if (!want || capture?.readyState !== 'live') return;
    }
    // Don't retry forever if the OS keeps refusing the mic (a phone call holding
    // it, permission revoked mid-call). After a few tries, show the user as muted
    // rather than lying about being live — tapping Unmute starts a fresh round.
    if (restoreAttemptsRef.current >= MIC_RESTORE_ATTEMPTS) return;
    restoreAttemptsRef.current += 1;
    restoringRef.current = true;
    void room.localParticipant
      .setMicrophoneEnabled(want)
      .catch(() => {
        // Only give up on screen — a background failure is iOS being iOS, and
        // coming back resets the attempts for a proper try.
        if (want && pageVisible() && restoreAttemptsRef.current >= MIC_RESTORE_ATTEMPTS) {
          micIntentRef.current = false;
          setMuted(true);
        }
      })
      .finally(() => {
        restoringRef.current = false;
      });
  }, [room]);

  // Connect the room to a call. Shared by a fresh join and by the automatic
  // rejoin after a drop — a rejoin keeps the user's mute choice and chat, and
  // doesn't fail the whole call just because iOS is slow to hand the mic back
  // (reconcileMic keeps trying once we're connected).
  const connect = useCallback(
    (nextCallId: string, rejoin: boolean) => {
      if (!room) return;
      joiningRef.current = nextCallId;
      setCallId(nextCallId);
      setStatus('connecting');
      setError(null);

      void (async () => {
        try {
          const conn = await apiFetch<TokenResponse>(`/api/calls/${nextCallId}/token`, {
            method: 'POST',
          });
          if (joiningRef.current !== nextCallId) return; // superseded while fetching
          if (room.state !== ConnectionState.Disconnected) await room.disconnect();
          await room.connect(conn.serverUrl, conn.token);
          if (joiningRef.current !== nextCallId) {
            await room.disconnect();
            return;
          }
          if (!rejoin) micIntentRef.current = true;
          restoreAttemptsRef.current = 0;
          const mic = room.localParticipant.setMicrophoneEnabled(micIntentRef.current);
          await (rejoin ? mic.catch(() => {}) : mic);
          setCallName(conn.name);
          setMuted(!micIntentRef.current);
          setCameraOn(false); // join voice-first; camera is opt-in
          if (!rejoin) setConnectedAt(Date.now());
          const started = Date.parse(conn.startedAt);
          setCallStartedAt(Number.isNaN(started) ? Date.now() : started);
          setStatus('connected');
        } catch (err) {
          if (joiningRef.current !== nextCallId) return;
          joiningRef.current = null;
          setError(err instanceof Error ? err.message : 'Could not join the call.');
          setStatus('error');
        }
      })();
    },
    [room],
  );

  // Fire the owed rejoin, but only on screen (see pendingRejoinRef).
  const startRejoin = useCallback(() => {
    const id = pendingRejoinRef.current;
    if (!id || !pageVisible()) return;
    pendingRejoinRef.current = null;
    connect(id, true);
  }, [connect]);

  // Room lifecycle: mirror the local track state, and rejoin (or fall back to
  // idle) if the connection drops. Cleanup disconnects the room on unmount.
  useEffect(() => {
    if (!room) return;
    const syncLocal = () => {
      setCameraOn(room.localParticipant.isCameraEnabled);
      // The UI always shows the user's own choice — never the OS's opinion of it.
      setMuted(!micIntentRef.current);
      reconcileMic();
    };
    const onDisconnected = (reason?: DisconnectReason) => {
      const id = callIdRef.current;
      // Dropped mid-call (not hung up / ended / removed): stay "in" the call and
      // reconnect instead of kicking the person back to the Hub. This is what
      // used to happen after iOS suspended the app or "Stop recording" was hit.
      if (id && statusRef.current === 'connected' && !FINAL_DISCONNECTS.has(reason)) {
        joiningRef.current = id; // hold the slot so join() from the call screen no-ops
        pendingRejoinRef.current = id;
        setStatus('connecting');
        startRejoin();
        return;
      }
      resetToIdle();
    };
    // Incoming chat: decode the data-channel packet and append. Anything that
    // isn't a well-formed chat message on our topic is ignored.
    const onData = (
      payload: Uint8Array,
      participant?: { identity?: string; name?: string; metadata?: string },
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== CHAT_TOPIC) return;
      let text: string;
      try {
        const parsed = JSON.parse(chatDecoder.decode(payload)) as { text?: unknown };
        if (typeof parsed.text !== 'string' || !parsed.text.trim()) return;
        text = parsed.text;
      } catch {
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `${participant?.identity ?? 'peer'}-${Date.now()}-${prev.length}`,
          text,
          senderId: participant?.identity ?? '',
          senderName: participant?.name || participant?.identity || 'Member',
          senderImage: participantImage(participant?.metadata),
          isLocal: false,
          at: Date.now(),
        },
      ]);
    };
    room
      .on(RoomEvent.Disconnected, onDisconnected)
      .on(RoomEvent.DataReceived, onData)
      .on(RoomEvent.LocalTrackPublished, syncLocal)
      .on(RoomEvent.LocalTrackUnpublished, syncLocal)
      .on(RoomEvent.TrackMuted, syncLocal)
      .on(RoomEvent.TrackUnmuted, syncLocal);
    return () => {
      room
        .off(RoomEvent.Disconnected, onDisconnected)
        .off(RoomEvent.DataReceived, onData)
        .off(RoomEvent.LocalTrackPublished, syncLocal)
        .off(RoomEvent.LocalTrackUnpublished, syncLocal)
        .off(RoomEvent.TrackMuted, syncLocal)
        .off(RoomEvent.TrackUnmuted, syncLocal);
      room.disconnect();
    };
  }, [room, resetToIdle, reconcileMic, startRejoin]);

  // Coming back to the app is the moment to repair the call: iOS has usually
  // suspended (or dropped) the mic track — or the whole connection — while we
  // were away. Give it a beat to hand the audio session back before asking for
  // the mic again.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onVisible = () => {
      if (!pageVisible()) return;
      restoreAttemptsRef.current = 0;
      clearTimeout(timer);
      timer = setTimeout(() => {
        startRejoin();
        reconcileMic();
      }, 400);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [reconcileMic, startRejoin]);

  const join = useCallback(
    (nextCallId: string) => {
      if (!room) return;
      // Already in this call, or already connecting / rejoining it — returning to
      // the call screen from the MiniCallBar is a no-op.
      if (joiningRef.current === nextCallId) return;
      if (callIdRef.current === nextCallId && statusRef.current === 'connected') return;
      pendingRejoinRef.current = null;
      connect(nextCallId, false);
    },
    [room, connect],
  );

  const leave = useCallback(async () => {
    joiningRef.current = null;
    if (room) await room.disconnect();
    resetToIdle();
  }, [room, resetToIdle]);

  // The only thing that changes mute state. Flips intent first, so the OS
  // suspending the track later can't be mistaken for the user muting.
  const toggleMute = useCallback(() => {
    if (!room || statusRef.current !== 'connected') return;
    const next = !micIntentRef.current;
    micIntentRef.current = next;
    restoreAttemptsRef.current = 0;
    setMuted(!next);
    room.localParticipant.setMicrophoneEnabled(next).catch(() => {});
  }, [room]);

  const toggleCamera = useCallback(() => {
    if (!room || statusRef.current !== 'connected') return;
    const next = !room.localParticipant.isCameraEnabled;
    setCameraOn(next); // optimistic; the RoomEvent listener reconciles
    room.localParticipant.setCameraEnabled(next).catch(() => setCameraOn(!next));
  }, [room]);

  const stopCamera = useCallback(() => {
    if (!room || !room.localParticipant.isCameraEnabled) return;
    setCameraOn(false); // optimistic; the RoomEvent listener reconciles
    room.localParticipant.setCameraEnabled(false).catch(() => {});
  }, [room]);

  const sendChat = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!room || statusRef.current !== 'connected' || !trimmed) return;
      const me = room.localParticipant;
      // Reliable delivery so messages aren't dropped like unreliable data can be.
      room.localParticipant
        .publishData(chatEncoder.encode(JSON.stringify({ text: trimmed })), {
          reliable: true,
          topic: CHAT_TOPIC,
        })
        .catch(() => {});
      // DataReceived never fires for our own packets, so echo locally.
      setMessages((prev) => [
        ...prev,
        {
          id: `me-${Date.now()}-${prev.length}`,
          text: trimmed,
          senderId: me.identity,
          senderName: me.name || 'You',
          senderImage: participantImage(me.metadata),
          isLocal: true,
          at: Date.now(),
        },
      ]);
    },
    [room],
  );

  const markChatRead = useCallback(() => setSeenCount(messages.length), [messages.length]);
  // Only other people's messages count as unread — your own never light the dot.
  const unreadChat = messages.slice(seenCount).filter((m) => !m.isLocal).length;

  const value: CallContextValue = {
    callId,
    callName,
    status,
    error,
    muted,
    cameraOn,
    connectedAt,
    callStartedAt,
    join,
    leave,
    toggleMute,
    toggleCamera,
    stopCamera,
    messages,
    sendChat,
    unreadChat,
    markChatRead,
  };

  // Expose the LiveKit room to @livekit/components-react hooks below (participant
  // snapshots, RoomAudioRenderer). Audio renders app-wide while connected, so the
  // conversation keeps playing after you navigate away from the call screen.
  const tree =
    room != null ? (
      <RoomContext.Provider value={room}>
        {children}
        {status === 'connected' && <RoomAudioRenderer />}
      </RoomContext.Provider>
    ) : (
      children
    );

  return <CallCtx.Provider value={value}>{tree}</CallCtx.Provider>;
}

// ---------------------------------------------------------------------------

export type CallParticipant = {
  id: string;
  name: string;
  image: string | null;
  isLocal: boolean;
  isSpeaking: boolean;
  micOn: boolean;
  cameraOn: boolean;
};

// The joiner's profile-picture URL is carried in participant metadata (set on
// the LiveKit token; see /api/calls/[id]/token). Parse it defensively.
function participantImage(metadata: string | undefined): string | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as { image?: unknown };
    return typeof parsed.image === 'string' ? parsed.image : null;
  } catch {
    return null;
  }
}

// A live snapshot of everyone in the room. Rebuilt on any roster / speaking /
// mute change so orbs light up as people talk and mute. Self-contained (reads
// the room off RoomContext) rather than composing per-participant hooks.
export function useCallParticipants(): CallParticipant[] {
  const room = useMaybeRoomContext();
  const [list, setList] = useState<CallParticipant[]>([]);

  useEffect(() => {
    if (!room) return;
    const snapshot = () => {
      const all = [room.localParticipant, ...room.remoteParticipants.values()];
      setList(
        all.map((p) => ({
          id: p.identity,
          name: p.name || p.identity || 'Member',
          image: participantImage(p.metadata),
          isLocal: p.isLocal,
          isSpeaking: p.isSpeaking,
          micOn: p.isMicrophoneEnabled,
          cameraOn: p.isCameraEnabled,
        })),
      );
    };
    snapshot();
    const events: RoomEvent[] = [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ActiveSpeakersChanged,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.ConnectionStateChanged,
    ];
    events.forEach((e) => room.on(e, snapshot));
    return () => {
      events.forEach((e) => room.off(e, snapshot));
    };
  }, [room]);

  return list;
}

// ---------------------------------------------------------------------------

/** Live seconds elapsed since `since` (epoch ms), ticking every second. */
export function useElapsed(since: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since == null) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  return since == null ? 0 : Math.max(0, Math.floor((now - since) / 1000));
}

/** Format seconds as m:ss (or h:mm:ss past an hour). */
export function formatElapsed(total: number): string {
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}
