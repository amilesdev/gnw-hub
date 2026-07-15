import type { MemberSection, Role } from '@prisma/client';

// The minimal viewer shape the visibility rules need — satisfied by both the
// session user (client) and a fresh DB user (server).
export type Viewer = { role: Role; section?: MemberSection | null };

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
