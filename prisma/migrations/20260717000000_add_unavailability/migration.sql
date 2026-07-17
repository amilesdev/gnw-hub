-- Member availability / blackout dates. A brand-new table — no existing data is
-- touched. Each row is an inclusive UTC calendar-day range a member marked
-- themselves away (single day → startDate == endDate). Leaders read these when
-- scheduling so an away member isn't assigned to that day's service/rehearsal.

CREATE TABLE "Unavailability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unavailability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Unavailability_userId_idx" ON "Unavailability"("userId");

CREATE INDEX "Unavailability_startDate_endDate_idx" ON "Unavailability"("startDate", "endDate");

ALTER TABLE "Unavailability" ADD CONSTRAINT "Unavailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
