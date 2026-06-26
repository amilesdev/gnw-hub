-- AlterTable
ALTER TABLE "Song" ADD COLUMN     "lyricChart" JSONB,
ADD COLUMN     "lyricChartUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "lyricDocUrl" TEXT;
