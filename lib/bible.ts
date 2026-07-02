// A small local set of encouraging KJV verses for friendly empty states on
// the member home screen. Kept local (no network) so the home page never waits
// on a third-party API to render.

export type Verse = { text: string; reference: string };

const VERSES: Verse[] = [
  { text: 'I can do all things through Christ which strengtheneth me.', reference: 'Philippians 4:13' },
  { text: 'Make a joyful noise unto the LORD, all ye lands. Serve the LORD with gladness: come before his presence with singing.', reference: 'Psalm 100:1-2' },
  { text: 'O come, let us sing unto the LORD: let us make a joyful noise to the rock of our salvation.', reference: 'Psalm 95:1' },
  { text: 'O magnify the LORD with me, and let us exalt his name together.', reference: 'Psalm 34:3' },
  { text: 'Let every thing that hath breath praise the LORD. Praise ye the LORD.', reference: 'Psalm 150:6' },
  { text: 'Speaking to yourselves in psalms and hymns and spiritual songs, singing and making melody in your heart to the Lord.', reference: 'Ephesians 5:19' },
  { text: 'O sing unto the LORD a new song: sing unto the LORD, all the earth.', reference: 'Psalm 96:1' },
  { text: 'This is the day which the LORD hath made; we will rejoice and be glad in it.', reference: 'Psalm 118:24' },
  { text: 'Sing unto him a new song; play skilfully with a loud noise.', reference: 'Psalm 33:3' },
  { text: 'I will sing unto the LORD as long as I live: I will sing praise to my God while I have my being.', reference: 'Psalm 104:33' },
  { text: 'Sing unto the LORD, O ye saints of his, and give thanks at the remembrance of his holiness.', reference: 'Psalm 30:4' },
  { text: 'Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.', reference: 'Romans 15:13' },
];

export function getRandomVerse(): Verse {
  return VERSES[Math.floor(Math.random() * VERSES.length)];
}

/**
 * A stable "verse of the day": the same verse for everyone until the next
 * rollover, so the home ribbon doesn't reshuffle on every request. The day
 * rolls over at 6am Eastern (America/New_York, DST-aware): we read the wall
 * clock in that zone, shift it back 6 hours, and bucket by the resulting
 * calendar day — so 5am shows yesterday's verse and 6am flips to today's.
 */
export function getVerseOfDay(now: Date = new Date()): Verse {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23', // guarantee 00–23, never a "24" at midnight
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  // Anchor the Eastern wall-clock fields to a tz-free timestamp, roll back 6h so
  // the day boundary lands at 6am, then take a continuous day index.
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour));
  const dayIndex = Math.floor((wall - 6 * 3_600_000) / 86_400_000);
  return VERSES[((dayIndex % VERSES.length) + VERSES.length) % VERSES.length];
}
