-- Profile pictures. Additive, nullable column — no existing data is touched.
-- Stores the Supabase Storage public URL of the member's uploaded avatar
-- (under `avatars/<userId>/`); NULL means "no photo, fall back to the initial".

ALTER TABLE "User" ADD COLUMN "image" TEXT;
