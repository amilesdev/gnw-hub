-- Drive link retired from songs. Destructive: drops the column and any stored
-- Google Drive URLs. YouTube link is now the only external reference on a song.
ALTER TABLE "Song" DROP COLUMN "driveLink";
