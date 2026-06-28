-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('multiple_choice', 'true_false');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('classic', 'team_battle', 'survival');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('lobby', 'active', 'ended');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('answering', 'revealing', 'between_rounds');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "playPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "QuestionPack" (
    "id" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "mode" "GameMode" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'lobby',
    "settings" JSONB NOT NULL,
    "questionOrder" JSONB NOT NULL,
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "guestAccessEnabled" BOOLEAN NOT NULL DEFAULT false,
    "guestLinkToken" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePlayer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "team" TEXT,
    "hearts" INTEGER NOT NULL DEFAULT 3,
    "isEliminated" BOOLEAN NOT NULL DEFAULT false,
    "isSpectator" BOOLEAN NOT NULL DEFAULT false,
    "playPointsEarned" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "isCorrect" BOOLEAN,
    "timeTakenMs" INTEGER,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GameAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundState" (
    "sessionId" TEXT NOT NULL,
    "questionStartAt" TIMESTAMP(3),
    "roundNumber" INTEGER NOT NULL DEFAULT 0,
    "status" "RoundStatus" NOT NULL DEFAULT 'between_rounds',

    CONSTRAINT "RoundState_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "GameTeam" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teamPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GameTeam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionPack_createdById_updatedAt_idx" ON "QuestionPack"("createdById", "updatedAt");

-- CreateIndex
CREATE INDEX "Question_packId_orderIndex_idx" ON "Question"("packId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_guestLinkToken_key" ON "GameSession"("guestLinkToken");

-- CreateIndex
CREATE INDEX "GameSession_status_idx" ON "GameSession"("status");

-- CreateIndex
CREATE INDEX "GamePlayer_sessionId_idx" ON "GamePlayer"("sessionId");

-- CreateIndex
CREATE INDEX "GamePlayer_userId_idx" ON "GamePlayer"("userId");

-- CreateIndex
CREATE INDEX "GameAnswer_sessionId_questionId_idx" ON "GameAnswer"("sessionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "GameAnswer_playerId_questionId_key" ON "GameAnswer"("playerId", "questionId");

-- CreateIndex
CREATE INDEX "GameTeam_sessionId_idx" ON "GameTeam"("sessionId");

-- AddForeignKey
ALTER TABLE "QuestionPack" ADD CONSTRAINT "QuestionPack_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_packId_fkey" FOREIGN KEY ("packId") REFERENCES "QuestionPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_packId_fkey" FOREIGN KEY ("packId") REFERENCES "QuestionPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAnswer" ADD CONSTRAINT "GameAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAnswer" ADD CONSTRAINT "GameAnswer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "GamePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAnswer" ADD CONSTRAINT "GameAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundState" ADD CONSTRAINT "RoundState_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTeam" ADD CONSTRAINT "GameTeam_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
