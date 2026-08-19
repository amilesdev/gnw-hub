-- Administrative assistant capability.
--
-- A single narrow permission, deliberately NOT a new role: the holder may
-- import/replace/remove a song's lyric chart and nothing else. Mirrors the
-- existing "callLeader" / "vocalDirector" flags in shape and intent.
--
-- Additive only: one new column with a default — no existing data is touched,
-- and every current user starts at false.

ALTER TABLE "User" ADD COLUMN "adminAssistant" BOOLEAN NOT NULL DEFAULT false;
