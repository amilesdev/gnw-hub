import type { MemberSection, Role } from '@prisma/client';

// The minimal viewer shape the visibility rules need — satisfied by both the
// session user (client) and a fresh DB user (server).
export type Viewer = {
  role: Role;
  section?: MemberSection | null;
  isSuperAdmin?: boolean;
  vocalDirector?: boolean;
  adminAssistant?: boolean;
  attireReviewer?: boolean;
  chatModerator?: boolean;
  chatEarlyAccess?: boolean;
};

/**
 * Chat's soft launch: while false, only leaders, moderators (super admin
 * included) and `chatEarlyAccess` testers can use chat at all. Members keep the "Coming Soon" tab, the chat
 * API 404s for them, they can't be added to a chat and get no chat pushes.
 * Flip to true when members' chats move over (Docs/Chat-Feature.md, Phase 5).
 */
export const CHAT_OPEN_TO_MEMBERS = false;

/**
 * Who can use chat at all (see {@link CHAT_OPEN_TO_MEMBERS}). Being in a chat is
 * still required to see it. lib/chat/server.ts → `CHAT_USERS` is the same rule
 * as a DB filter; keep the two in step.
 *
 * `chatEarlyAccess` (User.chatEarlyAccess, granted from the backend only) lets a
 * member in early as a tester. They use chat exactly as a member will: no
 * creating chats, adding people, @all or moderation.
 */
export function canUseChat(v: Viewer): boolean {
  return CHAT_OPEN_TO_MEMBERS || v.role === 'leader' || v.chatEarlyAccess === true || canModerateChat(v);
}

/**
 * Who may create chats and topics, and add people to a chat: the super admin
 * and anyone with the leader role. (Removing people is moderation — see
 * {@link canModerateChat}.)
 */
export function canCreateChats(v: Viewer): boolean {
  return v.isSuperAdmin === true || v.role === 'leader';
}

/**
 * Who moderates chat — deletes anyone's message, removes people from a chat,
 * archives a chat or topic: the super admin, plus a user flagged
 * `chatModerator` (granted from the backend only). Deliberately NOT every
 * leader. Seeing a chat still requires being in it; this grants no access.
 */
export function canModerateChat(v: Viewer): boolean {
  return v.isSuperAdmin === true || v.chatModerator === true;
}

/** Who may @all a chat (it breaks through mute): leaders + moderators. */
export function canMentionAll(v: Viewer): boolean {
  return v.role === 'leader' || canModerateChat(v);
}

/**
 * Who reviews Crossover looks — approves a member's submitted outfit or asks
 * for changes: only a user flagged `attireReviewer` (User.attireReviewer,
 * granted from the backend only). Deliberately NOT every leader: approval is one
 * person's call, so the team gets one consistent answer.
 */
export function canReviewLooks(v: Viewer): boolean {
  return v.attireReviewer === true;
}

/**
 * Band-section members get number charts + arrangements in place of the vocal
 * parts and lyrics that vocalists see. A leader always sees everything — that
 * includes the one person who is both a leader and a band member.
 */
export function canSeeVocals(v: Viewer): boolean {
  return v.role === 'leader' || v.section !== 'Band';
}

/** Mirror of {@link canSeeVocals}: who gets the band number charts/arrangements. */
export function canSeeBandCharts(v: Viewer): boolean {
  return v.role === 'leader' || v.section === 'Band';
}

/**
 * Who may add, replace, or remove a song's four vocal-part audio files: any
 * leader, plus a member flagged `vocalDirector` (User.vocalDirector — granted
 * from the backend only).
 *
 * This is the WHOLE of that grant. It says nothing about events, setlists, song
 * titles/keys/BPM, band arrangements, lyric charts, or retiring a song — those
 * stay leader-only, enforced in the API routes, not just hidden in the UI.
 */
export function canEditVocalParts(v: Viewer): boolean {
  return v.role === 'leader' || v.vocalDirector === true;
}

/**
 * Who gets the vocal-part editing affordances INSIDE the song card. Narrower
 * than {@link canEditVocalParts} on purpose, and a UI rule only — permission is
 * still that function's (and the API guards') call.
 *
 * Leaders have always edited parts from Edit Setlist → Audio slots, and their
 * song card is a reader's view; a second editor in the card changed a screen
 * they never asked to have changed. The in-card editor exists solely because
 * the vocal director has no Edit Setlist to work from.
 */
export function editsVocalPartsInSongCard(v: Viewer): boolean {
  return v.role !== 'leader' && v.vocalDirector === true;
}

/**
 * Who may import, re-import, or remove a song's lyric chart: any leader, plus a
 * member flagged `adminAssistant` (User.adminAssistant — granted from the
 * backend only).
 *
 * This is the WHOLE of that grant, the exact counterpart of
 * {@link canEditVocalParts}. It says nothing about events, setlists, song
 * titles/keys/BPM, vocal parts, band arrangements, or retiring a song — those
 * stay leader-only, enforced in the API routes, not just hidden in the UI.
 */
export function canEditLyricCharts(v: Viewer): boolean {
  return v.role === 'leader' || v.adminAssistant === true;
}
