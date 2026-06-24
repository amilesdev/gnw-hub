-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('member', 'leader');

-- CreateEnum
CREATE TYPE "VoicePart" AS ENUM ('Soprano', 'Alto', 'Tenor');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending', 'active');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('service', 'rehearsal', 'prayer', 'holy_talks', 'other');

-- CreateEnum
CREATE TYPE "RepeatCadence" AS ENUM ('once', 'weekly', 'biweekly', 'monthly');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'member',
    "voicePart" "VoicePart",
    "status" "UserStatus" NOT NULL DEFAULT 'pending',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "inviteToken" TEXT,
    "inviteExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "type" "EventType" NOT NULL DEFAULT 'service',
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "repeats" "RepeatCadence" NOT NULL DEFAULT 'once',
    "notes" TEXT,
    "seriesId" TEXT,
    "attirePrimary" TEXT,
    "attireSecondary" TEXT,
    "attireComplement" TEXT,
    "attireNotes" TEXT,
    "attirePhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topic" TEXT,
    "scriptures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "holyTalksNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setlist" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "setlistId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "songTitle" TEXT NOT NULL,
    "youtubeLink" TEXT,
    "driveLink" TEXT,
    "audioSoprano" TEXT,
    "audioAlto" TEXT,
    "audioTenor" TEXT,
    "audioAllParts" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EventSetlists" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventSetlists_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteToken_key" ON "User"("inviteToken");

-- CreateIndex
CREATE INDEX "Event_date_idx" ON "Event"("date");

-- CreateIndex
CREATE INDEX "Event_seriesId_idx" ON "Event"("seriesId");

-- CreateIndex
CREATE INDEX "Setlist_month_idx" ON "Setlist"("month");

-- CreateIndex
CREATE INDEX "Song_setlistId_position_idx" ON "Song"("setlistId", "position");

-- CreateIndex
CREATE INDEX "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");

-- CreateIndex
CREATE INDEX "_EventSetlists_B_index" ON "_EventSetlists"("B");

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "Setlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventSetlists" ADD CONSTRAINT "_EventSetlists_A_fkey" FOREIGN KEY ("A") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventSetlists" ADD CONSTRAINT "_EventSetlists_B_fkey" FOREIGN KEY ("B") REFERENCES "Setlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

