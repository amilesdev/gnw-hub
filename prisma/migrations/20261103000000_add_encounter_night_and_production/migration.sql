-- Encounter Night event type + Production (stage maps and task checklists).
--
-- Additive only: one new EventType value, one new enum, five new tables. No
-- existing rows are touched. Every FK to User is ON DELETE SET NULL and every
-- FK to Event is ON DELETE CASCADE, so deleting a member or an event never
-- fails because of production data.

-- CreateEnum
CREATE TYPE "ProductionKind" AS ENUM ('service', 'encounter_night', 'other');

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'encounter_night';

-- CreateTable
CREATE TABLE "StageMap" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "kind" "ProductionKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventProduction" (
    "eventId" TEXT NOT NULL,
    "stageMapId" TEXT,
    "changes" JSONB,
    "remindedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventProduction_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "ProductionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ProductionKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionTemplateTask" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "zone" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductionTemplateTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionTask" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "templateTaskId" TEXT,
    "zone" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageMap_kind_active_idx" ON "StageMap"("kind", "active");

-- CreateIndex
CREATE INDEX "EventProduction_stageMapId_idx" ON "EventProduction"("stageMapId");

-- CreateIndex
CREATE INDEX "ProductionTemplate_kind_idx" ON "ProductionTemplate"("kind");

-- CreateIndex
CREATE INDEX "ProductionTemplateTask_templateId_idx" ON "ProductionTemplateTask"("templateId");

-- CreateIndex
CREATE INDEX "ProductionTask_eventId_idx" ON "ProductionTask"("eventId");

-- CreateIndex
CREATE INDEX "ProductionTask_ownerId_idx" ON "ProductionTask"("ownerId");

-- CreateIndex
CREATE INDEX "ProductionTask_templateTaskId_idx" ON "ProductionTask"("templateTaskId");

-- AddForeignKey
ALTER TABLE "EventProduction" ADD CONSTRAINT "EventProduction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventProduction" ADD CONSTRAINT "EventProduction_stageMapId_fkey" FOREIGN KEY ("stageMapId") REFERENCES "StageMap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTemplateTask" ADD CONSTRAINT "ProductionTemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProductionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "ProductionTemplateTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

