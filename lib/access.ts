import type { MemberSection, Role } from '@prisma/client';

// The minimal viewer shape the visibility rules need — satisfied by both the
// session user (client) and a fresh DB user (server).
export type Viewer = {
  role: Role;
  section?: MemberSection | null;
  vocalDirector?: boolean;
  adminAssistant?: boolean;
};

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
