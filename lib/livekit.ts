import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { randomUUID } from 'crypto';

// LiveKit Cloud (voice/video). Mirrors lib/push.ts / lib/email.ts: if the keys
// aren't configured, we surface a clear error at call time rather than crashing
// at import, so the rest of the app keeps working without LiveKit set up.
const url = process.env.LIVEKIT_URL;
const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

export const livekitConfigured = !!url && !!apiKey && !!apiSecret;

/** The `wss://…` server URL clients connect to. Throws if LiveKit isn't set up. */
export function livekitUrl(): string {
  if (!url) throw new Error('LIVEKIT_URL is not configured');
  return url;
}

/** A fresh, unique LiveKit room identifier for a new call. */
export function newRoomName(): string {
  return `gnw-call-${randomUUID()}`;
}

/**
 * Seconds LiveKit keeps a room alive after the last participant leaves before it
 * tears the room down. This is the "auto-end" buffer: once everyone's gone the
 * room (and the call) closes ~this long later, and the DB row gets reconciled to
 * `ended` on the next `active` poll. Short, per the "immediately-ish is fine" ask.
 */
export const CALL_EMPTY_TIMEOUT_SEC = 15;

// Server-side admin client (REST). RoomServiceClient wants an http(s) host, so
// convert the wss:// realtime URL. Lazily built and reused across requests.
let roomService: RoomServiceClient | null = null;
function getRoomService(): RoomServiceClient {
  if (!livekitConfigured) throw new Error('LiveKit is not configured');
  if (!roomService) {
    roomService = new RoomServiceClient(url!.replace(/^ws/, 'http'), apiKey!, apiSecret!);
  }
  return roomService;
}

/**
 * Live participant counts keyed by LiveKit room name, for every room the server
 * currently knows about. A room absent from the map (or with count 0) has no one
 * connected — used to tell a genuinely-live call from a stale `active` DB row.
 */
export async function roomParticipantCounts(): Promise<Map<string, number>> {
  const rooms = await getRoomService().listRooms();
  return new Map(rooms.map((r) => [r.name, r.numParticipants]));
}

/**
 * Pre-create the LiveKit room with a short `emptyTimeout` so it auto-closes
 * shortly after the last participant leaves (rather than lingering for LiveKit's
 * multi-minute default). Best-effort: LiveKit still lazily creates the room on
 * first connect if this fails, just without our custom timeout.
 */
export async function ensureCallRoom(roomName: string): Promise<void> {
  if (!livekitConfigured) return;
  await getRoomService().createRoom({
    name: roomName,
    emptyTimeout: CALL_EMPTY_TIMEOUT_SEC,
  });
}

/**
 * Mint a join token for `room` scoped to one participant. Grants publish +
 * subscribe (join is open to everyone this pass), so the holder can share and
 * receive audio/video. `identity` should be the Hub user id; `name` is the
 * display name shown on their tile.
 */
export async function createJoinToken(opts: {
  room: string;
  identity: string;
  name: string;
  // Optional JSON string surfaced as `participant.metadata` client-side — used
  // to carry the member's avatar URL so tiles can show their profile picture.
  metadata?: string;
}): Promise<string> {
  if (!livekitConfigured) throw new Error('LiveKit is not configured');

  const at = new AccessToken(apiKey!, apiSecret!, {
    identity: opts.identity,
    name: opts.name,
    metadata: opts.metadata,
  });
  at.addGrant({
    room: opts.room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });
  return at.toJwt();
}
