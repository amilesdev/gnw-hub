-- Crossover: yearly seasons + Crossover-tagged events.
--
-- Additive only: one new enum, one new table, three nullable/defaulted columns
-- on Event. No existing rows change meaning (every event starts untagged). The
-- Event → CrossoverSeason FK is ON DELETE SET NULL, so removing a season never
-- deletes events.

-- CreateEnum
CREATE TYPE "CrossoverKind" AS ENUM ('gnw_rehearsal', 'all_team_rehearsal', 'dress_rehearsal', 'setup', 'crossover', 'other');

-- CreateTable
CREATE TABLE "CrossoverSeason" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "leaderKickoffSentAt" TIMESTAMP(3),
    "memberKickoffSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrossoverSeason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrossoverSeason_year_key" ON "CrossoverSeason"("year");

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "crossoverKind" "CrossoverKind",
ADD COLUMN "crossoverSeasonId" TEXT,
ADD COLUMN "crossoverLeadersOnly" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Event_crossoverSeasonId_idx" ON "Event"("crossoverSeasonId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_crossoverSeasonId_fkey" FOREIGN KEY ("crossoverSeasonId") REFERENCES "CrossoverSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
