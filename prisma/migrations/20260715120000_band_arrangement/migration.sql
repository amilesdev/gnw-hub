-- Band content on the library Song: a single arrangement audio file (behaves
-- like a vocal part) plus free-text musical key and BPM. All additive & nullable.
ALTER TABLE "Song" ADD COLUMN "arrangementAudio" TEXT;
ALTER TABLE "Song" ADD COLUMN "songKey" TEXT;
ALTER TABLE "Song" ADD COLUMN "bpm" TEXT;
