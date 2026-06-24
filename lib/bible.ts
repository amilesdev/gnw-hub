// A small local set of encouraging KJV verses for friendly empty states on
// the member home screen. Kept local (no network) so the home page never waits
// on a third-party API to render.

export type Verse = { text: string; reference: string };

const VERSES: Verse[] = [
  { text: 'I can do all things through Christ which strengtheneth me.', reference: 'Philippians 4:13' },
  { text: 'Make a joyful noise unto the LORD, all ye lands. Serve the LORD with gladness: come before his presence with singing.', reference: 'Psalm 100:1-2' },
  { text: 'O come, let us sing unto the LORD: let us make a joyful noise to the rock of our salvation.', reference: 'Psalm 95:1' },
  { text: 'Let the word of Christ dwell in you richly in all wisdom; teaching and admonishing one another in psalms and hymns and spiritual songs, singing with grace in your hearts to the Lord.', reference: 'Colossians 3:16' },
  { text: 'Let every thing that hath breath praise the LORD. Praise ye the LORD.', reference: 'Psalm 150:6' },
  { text: 'Speaking to yourselves in psalms and hymns and spiritual songs, singing and making melody in your heart to the Lord.', reference: 'Ephesians 5:19' },
  { text: 'O sing unto the LORD a new song: sing unto the LORD, all the earth.', reference: 'Psalm 96:1' },
  { text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.', reference: 'Isaiah 40:31' },
  { text: 'Sing unto him a new song; play skilfully with a loud noise.', reference: 'Psalm 33:3' },
  { text: 'Every good gift and every perfect gift is from above, and cometh down from the Father of lights, with whom is no variableness, neither shadow of turning.', reference: 'James 1:17' },
  { text: 'Sing unto the LORD, O ye saints of his, and give thanks at the remembrance of his holiness.', reference: 'Psalm 30:4' },
  { text: 'Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.', reference: 'Romans 15:13' },
];

export function getRandomVerse(): Verse {
  return VERSES[Math.floor(Math.random() * VERSES.length)];
}
