-- Announcement authorship + pinning
ALTER TABLE "Announcement" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Announcement" ADD COLUMN "authorId" TEXT;

-- CreateIndex
CREATE INDEX "Announcement_pinned_idx" ON "Announcement"("pinned");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
