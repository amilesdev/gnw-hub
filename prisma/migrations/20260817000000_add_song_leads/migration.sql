-- Song leaders.
--
-- "SongLead" is the live assignment: who leads a song on one setlist (per
-- SetlistSong placement, since leads switch off week to week).
--
-- "SongLastLead" + "Song"."lastLeadAt" are the library song's memory of the most
-- recent set of leaders, used to pre-fill the picker. It's separate because
-- expired setlists get deleted (pruneExpiredSetlists), which cascades their
-- SongLead rows away — the memory has to outlive them.
--
-- Additive only: two new tables + one new nullable column.

-- AlterTable
ALTER TABLE "Song" ADD COLUMN "lastLeadAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SongLead" (
    "id" TEXT NOT NULL,
    "setlistSongId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongLastLead" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongLastLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SongLead_setlistSongId_idx" ON "SongLead"("setlistSongId");

-- CreateIndex
CREATE INDEX "SongLead_userId_idx" ON "SongLead"("userId");

-- CreateIndex: one lead row per person per placement (co-leads = several rows).
CREATE UNIQUE INDEX "SongLead_setlistSongId_userId_key" ON "SongLead"("setlistSongId", "userId");

-- CreateIndex
CREATE INDEX "SongLastLead_songId_idx" ON "SongLastLead"("songId");

-- CreateIndex
CREATE INDEX "SongLastLead_userId_idx" ON "SongLastLead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SongLastLead_songId_userId_key" ON "SongLastLead"("songId", "userId");

-- AddForeignKey
ALTER TABLE "SongLead" ADD CONSTRAINT "SongLead_setlistSongId_fkey" FOREIGN KEY ("setlistSongId") REFERENCES "SetlistSong"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongLead" ADD CONSTRAINT "SongLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongLastLead" ADD CONSTRAINT "SongLastLead_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongLastLead" ADD CONSTRAINT "SongLastLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
