import type { Event, Announcement } from '@prisma/client';

// Shapes sent to the client (Dates → ISO strings).
export type EventDTO = Omit<Event, 'date' | 'createdAt' | 'updatedAt'> & {
  date: string;
  createdAt: string;
  updatedAt: string;
};

export function serializeEvent(e: Event): EventDTO {
  return {
    ...e,
    date: e.date.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export type AnnouncementDTO = Omit<Announcement, 'expiresAt' | 'createdAt' | 'updatedAt'> & {
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export function serializeAnnouncement(a: Announcement): AnnouncementDTO {
  return {
    ...a,
    expiresAt: a.expiresAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}
