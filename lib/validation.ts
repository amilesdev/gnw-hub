import { z } from 'zod';

export const sectionEnum = z.enum(['Vocalist', 'Band']);
export const VOCALIST_PARTS = ['Soprano', 'Alto', 'Tenor'] as const;
export const BAND_PARTS = ['Keys', 'Guitar', 'Bass', 'Drums'] as const;
export const partEnum = z.enum(['Soprano', 'Alto', 'Tenor', 'Keys', 'Guitar', 'Bass', 'Drums']);
export const roleEnum = z.enum(['member', 'leader']);
export const eventTypeEnum = z.enum(['service', 'rehearsal', 'prayer', 'holy_talks', 'other']);
export const repeatEnum = z.enum(['once', 'weekly', 'biweekly', 'monthly']);

/** A part must belong to its section (vocal parts for Vocalist, instruments for Band). */
function partMatchesSection(section: 'Vocalist' | 'Band', part: string): boolean {
  return section === 'Vocalist'
    ? (VOCALIST_PARTS as readonly string[]).includes(part)
    : (BAND_PARTS as readonly string[]).includes(part);
}

/** A Web Push subscription as serialized from the browser's PushSubscription. */
export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(500).optional(),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const inviteSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(120),
    email: z.string().email('Valid email required'),
    role: roleEnum.default('member'),
    section: sectionEnum,
    part: partEnum,
  })
  .refine((d) => partMatchesSection(d.section, d.part), {
    message: 'Part does not match the selected section',
    path: ['part'],
  });

export const editMemberSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    role: roleEnum.optional(),
    section: sectionEnum.optional(),
    part: partEnum.optional(),
  })
  .refine((d) => !(d.section && d.part) || partMatchesSection(d.section, d.part), {
    message: 'Part does not match the selected section',
    path: ['part'],
  });

export const claimSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(8),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email required'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(8),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(8),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

const songInput = z.object({
  songTitle: z.string().min(1, 'Song title required').max(200),
  youtubeLink: z.string().url().optional().or(z.literal('')).transform((v) => v || null),
});

export const setlistSchema = z.object({
  // The setlist belongs to a single event; its month is derived from that event.
  eventId: z.string().min(1, 'Pick an event'),
  songs: z.array(songInput).default([]),
});

// Accepts "#RGB" or "#RRGGBB" (case-insensitive); empty values are handled as null upstream.
const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color must be a hex value like #D4AF37');

export const vocalPartEnum = z.enum(VOCALIST_PARTS);

/** Singing assignments for a service — who sings which part. One part per person. */
export const assignmentsSchema = z
  .array(z.object({ userId: z.string().min(1), part: vocalPartEnum }))
  .max(60)
  .refine((rows) => new Set(rows.map((r) => r.userId)).size === rows.length, {
    message: 'A member can only be assigned to one part.',
  });

export const eventSchema = z.object({
  eventName: z.string().min(1, 'Event name required').max(200),
  type: eventTypeEnum,
  date: z.string().min(1, 'Date required'), // YYYY-MM-DD
  time: z.string().min(1, 'Time required'), // HH:mm
  location: z.string().min(1, 'Location required').max(200),
  repeats: repeatEnum.default('once'),
  notes: z.string().max(2000).optional().nullable(),
  attirePrimary: z.string().max(120).optional().nullable(),
  attirePrimaryHex: hexColor.optional().nullable(),
  attireSecondary: z.string().max(120).optional().nullable(),
  attireSecondaryHex: hexColor.optional().nullable(),
  attireComplement: z.string().max(120).optional().nullable(),
  attireComplementHex: hexColor.optional().nullable(),
  attireNotes: z.string().max(1000).optional().nullable(),
  attirePhotos: z.array(z.string().url()).optional().default([]),
  topic: z.string().max(200).optional().nullable(),
  scriptures: z.array(z.string()).optional().default([]),
  holyTalksNotes: z.string().max(2000).optional().nullable(),
  assignments: assignmentsSchema.optional().default([]),
});

export const prayerRequestSchema = z.object({
  body: z.string().min(1, 'Prayer request required').max(2000),
});

export const pollSchema = z
  .object({
    question: z.string().trim().min(1, 'Question is required').max(300),
    // Blank trailing fields from the form are dropped; need at least two real choices.
    choices: z
      .array(z.string())
      .transform((arr) => arr.map((s) => s.trim()).filter(Boolean))
      .pipe(z.array(z.string().max(200)).min(2, 'Add at least two choices').max(10, 'Up to 10 choices')),
    multiple: z.boolean().default(false),
    endsAt: z.string().min(1, 'End time is required'),
  })
  .refine((d) => new Date(d.endsAt).getTime() > Date.now(), {
    message: 'End time must be in the future',
    path: ['endsAt'],
  });

export const pollVoteSchema = z.object({
  choiceIds: z.array(z.string().min(1)).min(1, 'Pick an option'),
});

const MAX_ANNOUNCE_DAYS = 10;

export const announcementSchema = z
  .object({
    title: z.string().min(1, 'Title required').max(200),
    body: z.string().max(4000).optional().default(''),
    expiresAt: z.string().min(1, 'Expiry required'),
  })
  .refine(
    (d) => {
      const exp = new Date(d.expiresAt);
      const max = new Date();
      max.setDate(max.getDate() + MAX_ANNOUNCE_DAYS);
      return exp.getTime() <= max.getTime() + 60_000 && exp.getTime() > Date.now();
    },
    { message: `Expiry must be in the future and within ${MAX_ANNOUNCE_DAYS} days`, path: ['expiresAt'] },
  );

export const ANNOUNCEMENT_MAX_DAYS = MAX_ANNOUNCE_DAYS;

// Starting a call: the free-text name the leader typed, plus who it's open to.
// Audience defaults to the whole team, preserving the original behavior when the
// client doesn't send it.
export const callCreateSchema = z.object({
  name: z.string().trim().min(1, 'Call name required').max(120),
  audience: z.enum(['all_members', 'leaders_only']).default('all_members'),
});
