-- Replace the short-lived "seriesDay" (added earlier today; never used by a
-- deployed build and every row is NULL) with "seriesStart": the series' original
-- first date, from which every slot is computed.
ALTER TABLE "Event" DROP COLUMN "seriesDay";
ALTER TABLE "Event" ADD COLUMN "seriesStart" TIMESTAMP(3);
