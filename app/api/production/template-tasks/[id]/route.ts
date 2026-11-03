import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { getTemplates } from '@/lib/production/server';

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/production/template-tasks/[id] — remove a task from a template.
// Checklists already created keep their copy (its templateTaskId goes null).
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;
  await prisma.productionTemplateTask.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ templates: await getTemplates() });
}
