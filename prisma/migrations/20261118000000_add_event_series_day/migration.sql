-- Monthly series: the intended day of month (1–31), copied onto each occurrence.
-- Additive + nullable: safe for the running build (Prisma ignores unknown columns)
-- and existing rows stay NULL (they keep stepping from their latest occurrence).
ALTER TABLE "Event" ADD COLUMN "seriesDay" INTEGER;
