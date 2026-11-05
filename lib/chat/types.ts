// Chat DTOs + constants shared by the server (lib/chat/server.ts, app/api/chat)
// and the client (components/chat). Client-safe: no server imports here.

export type ChatAuthorDTO = { id: string; name: string; image: string | null };

export type ChatMessageDTO = {
  id: string;
  chatId: string;
  /** Null = not a Hub member (imported from GroupMe, or removed since) → "former member". */
  author: ChatAuthorDTO | null;
  importedAuthorName: string | null;
  importedAuthorAvatar: string | null;
  /** Null when deleted (the text is withheld) or for a media-only message. */
  text: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  replyToId: string | null;
  /** The quoted original, for the reply block above the text. */
  replyTo: ChatReplyPreviewDTO | null;
  pinnedAt: string | null;
  pinnedByName: string | null;
  mentionsAll: boolean;
  /** Hub users @mentioned (highlighted; the viewer's own id = "you were mentioned"). */
  mentionIds: string[];
  reactions: ChatReactionDTO[];
  attachments: ChatAttachmentDTO[];
  /** Echoed back so the sender's optimistic copy can be matched to the real one. */
  clientNonce: string | null;
};

export type ChatReplyPreviewDTO = {
  id: string;
  authorName: string | null;
  text: string | null;
  deleted: boolean;
  /** First attachment's kind, so a photo-only original still previews ("Photo"). */
  media: ChatMediaKind | null;
};

export type ChatReactionDTO = {
  emoji: string;
  count: number;
  /** Whether the viewer is one of them (their tap removes it). */
  mine: boolean;
  /** Who reacted, for the "who reacted" list. Imported non-members read as "Former member". */
  names: string[];
};

export type ChatMediaKind = 'image' | 'video';

/** A photo or video. URLs are short-lived signed URLs (private bucket) — never stored. */
export type ChatAttachmentDTO = {
  id: string;
  kind: ChatMediaKind;
  url: string;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
};

/** An uploaded file, as the composer sends it with a message (paths, not URLs). */
export type ChatAttachmentInput = {
  kind: ChatMediaKind;
  path: string;
  posterPath?: string | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  sizeBytes: number;
};

export type ChatLastMessageDTO = {
  text: string | null;
  authorName: string | null;
  deleted: boolean;
  createdAt: string;
  /** Set when the message has a photo/video (previews "Photo" for a media-only one). */
  media: ChatMediaKind | null;
};

export type ChatListItemDTO = {
  id: string;
  name: string;
  parentId: string | null;
  muted: boolean;
  archived: boolean;
  unread: number;
  lastMessage: ChatLastMessageDTO | null;
  /** Newest activity here (for topics: their own; for chats: theirs or any topic's). */
  activityAt: string | null;
  /** Topics, on root chats only. */
  topics: ChatListItemDTO[];
};

export type ChatListDTO = {
  chats: ChatListItemDTO[];
  /** Archived chats — only listed for moderators (so they can restore one). */
  archived: ChatListItemDTO[];
  /** Badge total: unread across every chat/topic that isn't muted. */
  unreadTotal: number;
};

export type ChatMemberDTO = {
  userId: string;
  name: string;
  image: string | null;
  status: 'pending' | 'active';
  /** Whether they have any device set up for push — shown to leaders/moderators only. */
  hasPush?: boolean;
};

export type ChatDetailDTO = {
  id: string;
  name: string;
  /** Set when this is a topic. */
  parent: { id: string; name: string } | null;
  /** The chat that owns membership (this chat, or a topic's parent). */
  rootId: string;
  archived: boolean;
  muted: boolean;
  topics: { id: string; name: string; archived: boolean }[];
  members: ChatMemberDTO[];
  can: {
    addMembers: boolean;
    removeMembers: boolean;
    createTopic: boolean;
    rename: boolean;
    archive: boolean;
    /** Permanently delete — moderators, and only once it's archived. */
    delete: boolean;
    /** @all (breaks through mute): leaders + moderators. */
    mentionAll: boolean;
    /** Delete anyone's message. */
    moderate: boolean;
  };
};

export type ChatMessagesPageDTO = {
  messages: ChatMessageDTO[];
  /** More exist beyond this page (older for `before`, newer for `after`; older for `around`). */
  hasMore: boolean;
  /** `around` only: newer messages exist past this page (the view isn't at the live end). */
  hasNewer?: boolean;
};

/** A run of a search hit's text; `hit` = matches the search (highlighted). */
export type ChatSnippetPartDTO = { text: string; hit?: boolean };

export type ChatSearchHitDTO = {
  id: string;
  chatId: string;
  chatName: string;
  /** Set when the hit is in a topic: the parent chat's name. */
  parentName: string | null;
  author: ChatAuthorDTO | null;
  importedAuthorName: string | null;
  importedAuthorAvatar: string | null;
  createdAt: string;
  snippet: ChatSnippetPartDTO[];
};

/**
 * `words` = full-text (whole words + prefixes, stemmed); `text` = the plain
 * substring fallback used when words find nothing (mid-word, emoji, "the").
 * The client passes `mode` back with `before` so later pages match the first.
 */
export type ChatSearchMode = 'words' | 'text';

export type ChatSearchPageDTO = { hits: ChatSearchHitDTO[]; hasMore: boolean; mode: ChatSearchMode };

export type ChatPersonDTO = { id: string; name: string; image: string | null; status: 'pending' | 'active' };

/**
 * A content-free realtime nudge (never message text). Sent on each user's own
 * topic; the client refetches from the API, which checks membership.
 *  - message: something new in chatId (messageId = the new one)
 *  - read:    you read chatId on another device — refresh your badges
 *  - chats:   your chat list changed (added to a chat, new topic, archived…)
 *  - update:  a message changed (edited, deleted, reacted to, pinned)
 */
export type ChatPing = { kind: 'message' | 'read' | 'chats' | 'update'; chatId?: string; messageId?: string };

export const CHAT_PING_EVENT = 'chat_ping';

export const CHAT_TEXT_MAX = 4000;
export const CHAT_NAME_MAX = 60;
export const CHAT_PAGE_SIZE = 50;
/** An `around` page (jumping to a search hit / reply original): this many on each side. */
export const CHAT_AROUND_SIDE = 25;
export const CHAT_SEARCH_PAGE_SIZE = 30;
export const CHAT_SEARCH_MAX = 100;
/** Catch-up fetches (after reconnect/resume) cap here; past it the client reloads the latest page. */
export const CHAT_CATCHUP_MAX = 200;
/** How often the open chat screen tells the server "I'm looking at this" (skips pushes). */
export const CHAT_VIEWING_HEARTBEAT_MS = 25_000;
/** A viewing heartbeat counts for this long. */
export const CHAT_VIEWING_WINDOW_MS = 45_000;
/** You can edit your own message for this long after sending (the user's call). */
export const CHAT_EDIT_WINDOW_MS = 15 * 60_000;
/** Per photo/video file (the user's call; the gnw-chat bucket enforces it too). */
export const CHAT_MEDIA_MAX_BYTES = 100 * 1024 * 1024;
export const CHAT_MAX_ATTACHMENTS = 10;
/** The one-tap reaction row; anything else comes from the full picker. */
export const QUICK_REACTIONS = ['❤️', '👍', '😂', '🙌', '🙏', '🔥'] as const;

/** Whether a message can still be edited by its author. */
export function withinEditWindow(createdAt: string | Date, now = Date.now()): boolean {
  return now - new Date(createdAt).getTime() < CHAT_EDIT_WINDOW_MS;
}

/** A single emoji (one grapheme with an emoji in it) — what a reaction must be. */
export function isSingleEmoji(s: string): boolean {
  if (!s || s.length > 16 || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s)) return false;
  const seg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
  return seg ? [...seg.segment(s)].length === 1 : true;
}

/** Display name for a chat or topic in a header/notification: "Worship › Attire". */
export function chatTitle(name: string, parentName?: string | null): string {
  return parentName ? `${parentName} › ${name}` : name;
}
