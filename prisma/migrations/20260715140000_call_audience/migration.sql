-- CreateEnum
CREATE TYPE "CallAudience" AS ENUM ('all_members', 'leaders_only');

-- AlterTable
ALTER TABLE "Call" ADD COLUMN "audience" "CallAudience" NOT NULL DEFAULT 'all_members';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "callLeader" BOOLEAN NOT NULL DEFAULT false;
