import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { revalidateAnnouncements, revalidateMembers, revalidateSetlists } from '@/lib/cache-tags';

const renameSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(1, 'Enter your name.').max(120, 'That name is too long.')),
});

// PATCH /api/profile — body: { name }. Rename yourself (Profile → Edit profile).
// Only the display name: email is the sign-in and the key everything else
// matches on (GroupMe import, Prayer-call allowlist), so it stays put.
export async function PATCH(req: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: guard.user.id },
    data: { name: parsed.data.name },
    select: { name: true },
  });

  // Names are baked into the shared team caches: members, singing assignments
  // and song leads (events + setlists), and announcement authors.
  revalidateMembers();
  revalidateSetlists();
  revalidateAnnouncements();

  return NextResponse.json({ ok: true, name: user.name });
}
