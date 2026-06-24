-- CreateTable
CREATE TABLE "SeriesSkip" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeriesSkip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeriesSkip_seriesId_idx" ON "SeriesSkip"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "SeriesSkip_seriesId_date_key" ON "SeriesSkip"("seriesId", "date");
