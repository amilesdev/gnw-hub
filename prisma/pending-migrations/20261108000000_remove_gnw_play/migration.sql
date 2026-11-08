-- Remove GNW Play (moving to its own app). Every Play table was empty when this
-- was written (2026-11-08). The guard below aborts the migration, before
-- anything is dropped, if any Play data has appeared since. Code to rebuild it
-- lives at git tag `play-archive`.
-- Generated offline with `prisma migrate diff` (schema file → schema file); the
-- chat search GIN index is untouched.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "QuestionPack") OR EXISTS (SELECT 1 FROM "GameSession") THEN
    RAISE EXCEPTION 'GNW Play still has data (QuestionPack/GameSession rows). Back it up before dropping.';
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "QuestionPack" DROP CONSTRAINT "QuestionPack_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_packId_fkey";

-- DropForeignKey
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_packId_fkey";

-- DropForeignKey
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_hostId_fkey";

-- DropForeignKey
ALTER TABLE "GamePlayer" DROP CONSTRAINT "GamePlayer_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "GamePlayer" DROP CONSTRAINT "GamePlayer_userId_fkey";

-- DropForeignKey
ALTER TABLE "GameAnswer" DROP CONSTRAINT "GameAnswer_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "GameAnswer" DROP CONSTRAINT "GameAnswer_playerId_fkey";

-- DropForeignKey
ALTER TABLE "GameAnswer" DROP CONSTRAINT "GameAnswer_questionId_fkey";

-- DropForeignKey
ALTER TABLE "RoundState" DROP CONSTRAINT "RoundState_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "GameTeam" DROP CONSTRAINT "GameTeam_sessionId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "playPoints";

-- DropTable
DROP TABLE "QuestionPack";

-- DropTable
DROP TABLE "Question";

-- DropTable
DROP TABLE "GameSession";

-- DropTable
DROP TABLE "GamePlayer";

-- DropTable
DROP TABLE "GameAnswer";

-- DropTable
DROP TABLE "RoundState";

-- DropTable
DROP TABLE "GameTeam";

-- DropEnum
DROP TYPE "QuestionType";

-- DropEnum
DROP TYPE "GameMode";

-- DropEnum
DROP TYPE "SessionStatus";

-- DropEnum
DROP TYPE "RoundStatus";
