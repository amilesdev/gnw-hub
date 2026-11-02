import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader, requireUser } from '@/lib/session';
import { suggestionStatusSchema } from '@/lib/validation';
import { serializeSuggestion } from '@/lib/serialize';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/suggestions/[id] — leader triage: pass on an open suggestion, or
// reopen a passed one. An added suggestion stays added (its song exists).
export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = suggestionStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const existing = await prisma.songSuggestion.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
  if (existing.status === 'added') {
    return NextResponse.json({ error: 'This one is already in the library.' }, { status: 409 });
  }

  const updated = await prisma.songSuggestion.update({ where: { id }, data: { status: parsed.data.status } });
  return NextResponse.json({ suggestion: serializeSuggestion(updated) });
}

// DELETE /api/suggestions/[id] — the suggester can take back their own
// suggestion while it's still open; leaders can remove any.
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const me = guard.user;
  const { id } = await params;

  const existing = await prisma.songSuggestion.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });

  const ownOpen = existing.suggestedById === me.id && existing.status === 'open';
  if (me.role !== 'leader' && !ownOpen) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.songSuggestion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
