-- Song suggestions.
--
-- Anyone on the team pastes a YouTube link; leaders add it to the library or
-- pass on it. Additive only: one new enum + one new table. No existing data is
-- touched. The only FK is SongSuggestion.songId → Song (ON DELETE SET NULL), so
-- retiring a library song never fails; the suggester is denormalized with no FK
-- to User, so member deletion is unaffected.

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('open', 'added', 'dismissed');

-- CreateTable
CREATE TABLE "SongSuggestion" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "songTitle" TEXT NOT NULL,
    "artist" TEXT,
    "videoTitle" TEXT,
    "channelName" TEXT,
    "suggestedById" TEXT,
    "suggestedByName" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'open',
    "songId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SongSuggestion_status_createdAt_idx" ON "SongSuggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SongSuggestion_videoId_idx" ON "SongSuggestion"("videoId");

-- AddForeignKey
ALTER TABLE "SongSuggestion" ADD CONSTRAINT "SongSuggestion_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;
