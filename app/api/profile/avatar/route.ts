import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { deleteObjects, pathFromPublicUrl, publicUrl } from '@/lib/supabase';
import { isOwnAvatarPath } from '@/lib/upload-path';

// Best-effort remove the object a public URL points at, if it's one of ours.
async function deleteByPublicUrl(url: string | null | undefined) {
  if (!url) return;
  const path = pathFromPublicUrl(url);
  if (path) await deleteObjects([path]).catch(() => {});
}

// POST /api/profile/avatar — body: { url }. Set your own profile picture.
// The browser has already uploaded the image to `avatars/<userId>/…` via the
// signed-URL flow; this just records the resulting public URL on the user and
// cleans up any previously-set avatar object.
export async function POST(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const url = body?.url;
  if (typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  // The URL must resolve to an object inside our bucket, under this user's own
  // avatar folder — so a member can't point their avatar at an arbitrary path.
  const path = pathFromPublicUrl(url);
  if (!path || !isOwnAvatarPath(path, guard.user.id)) {
    return NextResponse.json({ error: 'Invalid avatar URL.' }, { status: 400 });
  }
  // Canonicalize to the storage-derived public URL rather than trusting input.
  const canonical = publicUrl(path);

  const existing = await prisma.user.findUnique({
    where: { id: guard.user.id },
    select: { image: true },
  });

  await prisma.user.update({ where: { id: guard.user.id }, data: { image: canonical } });

  // Drop the old file (best effort) unless it's the same object being replaced.
  if (existing?.image && existing.image !== canonical) {
    await deleteByPublicUrl(existing.image);
  }

  return NextResponse.json({ ok: true, image: canonical });
}

// DELETE /api/profile/avatar — remove your profile picture (revert to initial).
export async function DELETE() {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const existing = await prisma.user.findUnique({
    where: { id: guard.user.id },
    select: { image: true },
  });

  await prisma.user.update({ where: { id: guard.user.id }, data: { image: null } });
  await deleteByPublicUrl(existing?.image);

  return NextResponse.json({ ok: true });
}
