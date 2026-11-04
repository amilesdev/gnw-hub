// Crossover schedules, stored as JSON on the season (client-safe: no Prisma).
//   • Day-of (Dec 31) and Dress Rehearsal + Setup (Dec 30): timed rows,
//     { time: "HH:mm", label, note? }, carried over from last year.
//   • The program — the order of the night: items that are either a set
//     ({ setId }, which shows that set's songs and singers live) or a segment
//     ({ label }), each with an optional text cue ("Poem" → "Line up for Set 2").

export type TimedRow = { time: string; label: string; note?: string };
export type ProgramItem = { id: string; setId?: string; label?: string; cue?: string };

export type ScheduleKind = 'dayOf' | 'dress';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Coerce stored JSON into well-formed timed rows, tolerating null / odd shapes. */
export function parseTimed(value: unknown): TimedRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({ time: str(x.time), label: str(x.label), ...(str(x.note) ? { note: str(x.note) } : {}) }));
}

/** Coerce stored JSON into program items (each a set or a labelled segment). */
export function parseProgram(value: unknown): ProgramItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x, i) => {
      const item: ProgramItem = { id: str(x.id) || `item-${i}` };
      if (str(x.setId)) item.setId = str(x.setId);
      else item.label = str(x.label);
      if (str(x.cue)) item.cue = str(x.cue);
      return item;
    })
    .filter((x) => x.setId || x.label);
}
