-- Flip the Event<->Setlist relation from 1:1 (Setlist.eventId) to many:1
-- (Event.setlistId), so one setlist can be linked to multiple events.

-- New FK column on Event
ALTER TABLE "Event" ADD COLUMN "setlistId" TEXT;

-- Backfill from the existing single-event links
UPDATE "Event" e SET "setlistId" = s."id"
FROM "Setlist" s
WHERE s."eventId" = e."id";

-- Index + FK for the new column
CREATE INDEX "Event_setlistId_idx" ON "Event"("setlistId");
ALTER TABLE "Event" ADD CONSTRAINT "Event_setlistId_fkey"
  FOREIGN KEY ("setlistId") REFERENCES "Setlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the old relation off Setlist
ALTER TABLE "Setlist" DROP CONSTRAINT "Setlist_eventId_fkey";
DROP INDEX "Setlist_eventId_key";
ALTER TABLE "Setlist" DROP COLUMN "eventId";
