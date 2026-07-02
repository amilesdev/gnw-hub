-- Session revocation + self-serve password reset.
-- Additive only: new columns on "User". tokenVersion defaults to 0 for every
-- existing row (so current sessions stay valid until an explicit bump); the
-- reset fields start NULL.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "resetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "resetExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");
