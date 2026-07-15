-- Promote Song to a reusable library and introduce the SetlistSong join.
--
-- Data-preserving: every existing Song currently belongs to exactly one setlist,
-- so we back each one out into a SetlistSong link (1:1) before dropping Song's
-- setlist columns. No song, chart, or audio URL is lost; duplicates across
-- setlists simply become distinct library rows that can be merged by hand later.
-- (gen_random_uuid() is built into Postgres 13+ / Supabase; the id column is a
-- plain String, so a uuid literal is a valid id for these backfilled rows.)

-- 1. The join table.
CREATE TABLE "SetlistSong" (
    "id" TEXT NOT NULL,
    "setlistId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetlistSong_pkey" PRIMARY KEY ("id")
);

-- 2. Backfill one link per existing song, preserving its setlist and position.
INSERT INTO "SetlistSong" ("id", "setlistId", "songId", "position", "createdAt")
SELECT gen_random_uuid()::text, "setlistId", "id", "position", "createdAt"
FROM "Song";

-- 3. Indexes & constraints on the join.
CREATE UNIQUE INDEX "SetlistSong_setlistId_songId_key" ON "SetlistSong"("setlistId", "songId");
CREATE INDEX "SetlistSong_setlistId_position_idx" ON "SetlistSong"("setlistId", "position");
CREATE INDEX "SetlistSong_songId_idx" ON "SetlistSong"("songId");

ALTER TABLE "SetlistSong" ADD CONSTRAINT "SetlistSong_setlistId_fkey"
    FOREIGN KEY ("setlistId") REFERENCES "Setlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SetlistSong" ADD CONSTRAINT "SetlistSong_songId_fkey"
    FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Song is now a library entity: drop its setlist ownership.
ALTER TABLE "Song" DROP CONSTRAINT "Song_setlistId_fkey";
DROP INDEX "Song_setlistId_position_idx";
ALTER TABLE "Song" DROP COLUMN "setlistId";
ALTER TABLE "Song" DROP COLUMN "position";

-- 5. Library browse/search by title.
CREATE INDEX "Song_songTitle_idx" ON "Song"("songTitle");
