-- Member sections (Vocalist / Band) and a broadened part enum, plus
-- moving setlists from a many-to-many on events to a single event per setlist.

-- CreateEnum
CREATE TYPE "MemberSection" AS ENUM ('Vocalist', 'Band');

-- Rename + broaden the part enum (Soprano/Alto/Tenor -> + Keys/Guitar/Bass/Drums)
ALTER TYPE "VoicePart" RENAME TO "MemberPart";
ALTER TYPE "MemberPart" ADD VALUE 'Keys';
ALTER TYPE "MemberPart" ADD VALUE 'Guitar';
ALTER TYPE "MemberPart" ADD VALUE 'Bass';
ALTER TYPE "MemberPart" ADD VALUE 'Drums';

-- User: rename voicePart -> part, add section, backfill existing rows as Vocalist.
ALTER TABLE "User" RENAME COLUMN "voicePart" TO "part";
ALTER TABLE "User" ADD COLUMN "section" "MemberSection";
UPDATE "User" SET "section" = 'Vocalist' WHERE "part" IS NOT NULL;

-- Setlist: one event per setlist.
ALTER TABLE "Setlist" ADD COLUMN "eventId" TEXT;

-- Backfill eventId from the old join table (first linked event per setlist).
UPDATE "Setlist" s
SET "eventId" = sub."A"
FROM (SELECT DISTINCT ON ("B") "B", "A" FROM "_EventSetlists" ORDER BY "B", "A") sub
WHERE sub."B" = s."id";

-- Drop the old many-to-many join table.
DROP TABLE "_EventSetlists";

-- CreateIndex
CREATE UNIQUE INDEX "Setlist_eventId_key" ON "Setlist"("eventId");

-- AddForeignKey
ALTER TABLE "Setlist" ADD CONSTRAINT "Setlist_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
