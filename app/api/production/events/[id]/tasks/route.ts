import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { ensureChecklist, getTask, serializeTask } from '@/lib/production/server';
import { ZONE_IDS } from '@/lib/production/graph';

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  zone: z.enum(ZONE_IDS as [string, ...string[]]).nullable(),
  ownerId: z.string().min(1).nullable().optional(),
});

// POST /api/production/events/[id]/tasks — a leader adds a one-off task to this
// event only (it has no template task, so it never carries forward).
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Give the task a name' }, { status: 400 });

  if (!(await ensureChecklist(id))) return NextResponse.json({ error: 'This event has no production checklist' }, { status: 404 });
  const last = await prisma.productionTask.aggregate({ where: { eventId: id }, _max: { sortOrder: true } });
  const created = await prisma.productionTask.create({
    data: {
      eventId: id,
      title: parsed.data.title,
      zone: parsed.data.zone,
      ownerId: parsed.data.ownerId ?? null,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
  });
  const task = await getTask(created.id);
  return NextResponse.json({ task: serializeTask(task!) }, { status: 201 });
}
