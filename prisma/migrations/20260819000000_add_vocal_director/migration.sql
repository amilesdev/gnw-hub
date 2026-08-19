-- Vocal director capability.
--
-- A single narrow permission, deliberately NOT a new role: the holder may
-- add/replace/remove a song's four vocal-part audio files and nothing else.
-- Mirrors the existing "callLeader" flag in shape and intent.
--
-- Additive only: one new column with a default — no existing data is touched,
-- and every current user starts at false.

ALTER TABLE "User" ADD COLUMN "vocalDirector" BOOLEAN NOT NULL DEFAULT false;
