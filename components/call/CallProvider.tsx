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
import { Room, RoomEvent, ConnectionState } from 'livekit-client';
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
  return new Room({ adaptiveStream: false, dynacast: false });
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

  // Which call we're currently joining. A slow token fetch for an abandoned join
  // must not connect us to a call we've since left.
  const joiningRef = useRef<string | null>(null);
  // Mirror latest state into refs so the callbacks below can stay identity-stable
  // (empty-ish deps) — consumers that call join() in an effect won't thrash.
  const callIdRef = useRef(callId);
  callIdRef.current = callId;
  const statusRef = useRef(status);
  statusRef.current = status;

  const resetToIdle = useCallback(() => {
    joiningRef.current = null;
    setCallId(null);
    setCallName(null);
    setStatus('idle');
    setError(null);
    setConnectedAt(null);
    setCallStartedAt(null);
    setMuted(false);
    setCameraOn(false);
    setMessages([]);
  }, []);

  // Room lifecycle: mirror the local mic state, and fall back to idle if the
  // connection drops. Cleanup disconnects the room when the app unmounts.
  useEffect(() => {
    if (!room) return;
    const syncLocal = () => {
      setMuted(!room.localParticipant.isMicrophoneEnabled);
      setCameraOn(room.localParticipant.isCameraEnabled);
    };
    const onDisconnected = () => resetToIdle();
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
  }, [room, resetToIdle]);

  const join = useCallback(
    (nextCallId: string) => {
      if (!room) return;
      // Already in this call, or already connecting to it — returning to the call
      // screen from the MiniCallBar is a no-op.
      if (joiningRef.current === nextCallId) return;
      if (callIdRef.current === nextCallId && statusRef.current === 'connected') return;

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
          await room.localParticipant.setMicrophoneEnabled(true);
          setCallName(conn.name);
          setMuted(false);
          setCameraOn(false); // join voice-first; camera is opt-in
          setConnectedAt(Date.now());
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

  const leave = useCallback(async () => {
    joiningRef.current = null;
    if (room) await room.disconnect();
    resetToIdle();
  }, [room, resetToIdle]);

  const toggleMute = useCallback(() => {
    if (!room || statusRef.current !== 'connected') return;
    const next = !room.localParticipant.isMicrophoneEnabled;
    setMuted(!next); // optimistic; the RoomEvent listener reconciles
    room.localParticipant.setMicrophoneEnabled(next).catch(() => setMuted(!next));
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
