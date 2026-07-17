// Rehearsal run-of-show: the preset, the setlist-aware label resolver, and the
// time-cascade math. Deliberately free of server/Prisma imports so both the
// leader editor (client) and the read-only detail view can share it.

export type RehearsalScheduleItem = {
  time: string; // "HH:mm" 24h label (from a native time input)
  // Plain rows: the full literal text. Song-review rows: the descriptor prefix
  // shown before the auto-filled song name (e.g. "Song Review:").
  label: string;
  // Present on a live-linked song-review row: the 1-based position in the
  // attached setlist whose title fills in the row. Resolved at render time so a
  // saved schedule always tracks the current setlist.
  songSlot?: number;
};

// The default rehearsal schedule. Song-review rows carry `songSlot` (1–3) rather
// than baked-in titles, so they read from whatever setlist is attached. Times are
// the leader-provided run-of-show (all evening / PM), as 24h labels.
export function buildRehearsalPreset(): RehearsalScheduleItem[] {
  return [
    { time: '19:30', label: 'Arrival' },
    { time: '20:00', label: 'Prayer' },
    { time: '20:10', label: 'Warm Ups' },
    { time: '20:25', label: 'Song Review:', songSlot: 1 },
    { time: '20:45', label: 'Song Review:', songSlot: 2 },
    { time: '21:05', label: 'Song Review:', songSlot: 3 },
    { time: '21:20', label: 'Band Review/Vocalist Break' },
    { time: '21:30', label: 'Run Sunday Set' },
    { time: '22:00', label: 'Flow/Space for Worship' },
    { time: '22:15', label: 'Prayer and Announcements' },
  ];
}

// The song name shown for a given slot: the setlist title at that position, or a
// "Song N" placeholder when no setlist is attached / it has fewer songs.
export function songNameForSlot(slot: number, setlistTitles: string[]): string {
  return setlistTitles[slot - 1] ?? `Song ${slot}`;
}

// A row's display label. Song rows become "<descriptor> <song name>"; plain rows
// are their literal label. Used by both the read-only view and the editor.
export function resolveScheduleLabel(item: RehearsalScheduleItem, setlistTitles: string[]): string {
  if (item.songSlot != null) {
    const name = songNameForSlot(item.songSlot, setlistTitles);
    return item.label.trim() ? `${item.label.trim()} ${name}` : name;
  }
  return item.label;
}

// --- time cascade -----------------------------------------------------------

export function timeToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Set the time on the row at `index` and cascade the change to every LATER row
// by the same delta, preserving each following gap. Earlier rows are never
// touched. No cascade when either the old or new time is blank/invalid (e.g. the
// first time being set on a freshly-added row) — that row is just assigned.
export function applyTimeEdit(
  items: RehearsalScheduleItem[],
  index: number,
  newTime: string,
): RehearsalScheduleItem[] {
  const withEdit = items.map((it, i) => (i === index ? { ...it, time: newTime } : it));
  const oldMin = timeToMinutes(items[index]?.time ?? '');
  const newMin = timeToMinutes(newTime);
  if (oldMin === null || newMin === null) return withEdit;
  const delta = newMin - oldMin;
  if (delta === 0) return withEdit;
  return withEdit.map((it, i) => {
    if (i <= index) return it;
    const m = timeToMinutes(it.time);
    return m === null ? it : { ...it, time: minutesToTime(m + delta) };
  });
}
