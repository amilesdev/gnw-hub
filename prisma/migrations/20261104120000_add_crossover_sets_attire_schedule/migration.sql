-- Crossover, part 2: sets + the Crossover song list, attire + looks, schedules,
-- and Crossover suggestions.
--
-- Additive only: three new enums, four new tables, new nullable/defaulted
-- columns. Every existing Song and SongSuggestion becomes scope 'library' (what
-- they already are), so the Song Library is unchanged. FKs to User and
-- CrossoverSeason are ON DELETE CASCADE (removing a member removes their set
-- spots and looks; it never fails).

-- CreateEnum
CREATE TYPE "SongScope" AS ENUM ('library', 'crossover');

-- CreateEnum
CREATE TYPE "LookStatus" AS ENUM ('pending', 'approved', 'changes_requested');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "attireReviewer" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Song" ADD COLUMN "scope" "SongScope" NOT NULL DEFAULT 'library';

-- AlterTable
ALTER TABLE "SongSuggestion" ADD COLUMN "scope" "SongScope" NOT NULL DEFAULT 'library';

-- AlterTable
ALTER TABLE "CrossoverSeason" ADD COLUMN "setsSeeded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "dayOfSchedule" JSONB,
ADD COLUMN "dressSchedule" JSONB,
ADD COLUMN "program" JSONB,
ADD COLUMN "attirePrimary" TEXT,
ADD COLUMN "attirePrimaryHex" TEXT,
ADD COLUMN "attireSecondary" TEXT,
ADD COLUMN "attireSecondaryHex" TEXT,
ADD COLUMN "attireComplement" TEXT,
ADD COLUMN "attireComplementHex" TEXT,
ADD COLUMN "attireNotes" TEXT,
ADD COLUMN "attirePhotos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CrossoverSet" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "minutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossoverSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossoverSetSong" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CrossoverSetSong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossoverSetSinger" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "part" "VocalPart" NOT NULL,

    CONSTRAINT "CrossoverSetSinger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossoverLook" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "photos" TEXT[],
    "note" TEXT,
    "status" "LookStatus" NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossoverLook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrossoverSet_seasonId_position_idx" ON "CrossoverSet"("seasonId", "position");

-- CreateIndex
CREATE INDEX "CrossoverSetSong_setId_position_idx" ON "CrossoverSetSong"("setId", "position");

-- CreateIndex
CREATE INDEX "CrossoverSetSong_songId_idx" ON "CrossoverSetSong"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "CrossoverSetSong_setId_songId_key" ON "CrossoverSetSong"("setId", "songId");

-- CreateIndex
CREATE INDEX "CrossoverSetSinger_setId_idx" ON "CrossoverSetSinger"("setId");

-- CreateIndex
CREATE INDEX "CrossoverSetSinger_userId_idx" ON "CrossoverSetSinger"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CrossoverSetSinger_setId_userId_key" ON "CrossoverSetSinger"("setId", "userId");

-- CreateIndex
CREATE INDEX "CrossoverLook_seasonId_status_idx" ON "CrossoverLook"("seasonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CrossoverLook_seasonId_userId_key" ON "CrossoverLook"("seasonId", "userId");

-- CreateIndex
CREATE INDEX "Song_scope_songTitle_idx" ON "Song"("scope", "songTitle");

-- CreateIndex
CREATE INDEX "SongSuggestion_scope_status_createdAt_idx" ON "SongSuggestion"("scope", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "CrossoverSet" ADD CONSTRAINT "CrossoverSet_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "CrossoverSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossoverSetSong" ADD CONSTRAINT "CrossoverSetSong_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CrossoverSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossoverSetSong" ADD CONSTRAINT "CrossoverSetSong_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossoverSetSinger" ADD CONSTRAINT "CrossoverSetSinger_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CrossoverSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossoverSetSinger" ADD CONSTRAINT "CrossoverSetSinger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossoverLook" ADD CONSTRAINT "CrossoverLook_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "CrossoverSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossoverLook" ADD CONSTRAINT "CrossoverLook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
