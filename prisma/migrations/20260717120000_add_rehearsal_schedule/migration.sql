-- Rehearsal schedule (rehearsal events only). Additive JSONB column on Event —
-- no existing data is touched. Holds an ordered array of { time, label } items
-- edited by leaders on the event form. Null on non-rehearsal events / legacy rows.

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "rehearsalSchedule" JSONB;
