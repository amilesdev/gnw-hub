import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, requireLeader } from '@/lib/session';
import { getTask, serializeTask } from '@/lib/production/server';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    done: z.boolean().optional(),
    ownerId: z.string().min(1).nullable().optional(),
  })
  .refine((d) => d.done !== undefined || d.ownerId !== undefined, 'Nothing to change');

// PATCH /api/production/tasks/[id] — check a task off (its owner or any
// leader), or change its owner (leaders only).
export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;
  const { user } = guard;
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const d = parsed.data;

  const task = await prisma.productionTask.findUnique({ where: { id }, select: { ownerId: true } });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  const isLeader = user.role === 'leader';

  if (d.ownerId !== undefined && !isLeader) {
    return NextResponse.json({ error: 'Only leaders can assign tasks' }, { status: 403 });
  }
  if (d.done !== undefined && !isLeader && task.ownerId !== user.id) {
    return NextResponse.json({ error: 'Only the task\'s owner or a leader can check it off' }, { status: 403 });
  }
  if (d.ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: d.ownerId }, select: { status: true } });
    if (!owner || owner.status !== 'active') return NextResponse.json({ error: 'That member isn\'t active' }, { status: 400 });
  }

  await prisma.productionTask.update({
    where: { id },
    data: {
      ...(d.ownerId !== undefined ? { ownerId: d.ownerId } : {}),
      ...(d.done !== undefined ? (d.done ? { doneAt: new Date(), doneById: user.id } : { doneAt: null, doneById: null }) : {}),
    },
  });
  const updated = await getTask(id);
  return NextResponse.json({ task: serializeTask(updated!) });
}

// DELETE /api/production/tasks/[id] — leaders remove a task from one event.
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;
  await prisma.productionTask.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
