import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { getTemplates } from '@/lib/production/server';
import { ZONE_IDS } from '@/lib/production/graph';

type Ctx = { params: Promise<{ kind: string }> };

const kindSchema = z.enum(['service', 'encounter_night', 'other']);
const schema = z.object({
  title: z.string().trim().min(1).max(200),
  zone: z.enum(ZONE_IDS as [string, ...string[]]).nullable(),
});

// POST /api/production/templates/[kind]/tasks — add a task to a template. Only
// events whose checklist is created after this pick it up.
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const kind = kindSchema.safeParse((await params).kind);
  if (!kind.success) return NextResponse.json({ error: 'Unknown template' }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Give the task a name' }, { status: 400 });

  const templates = await getTemplates(); // makes sure the template exists
  const template = templates.find((t) => t.kind === kind.data)!;
  const last = await prisma.productionTemplateTask.aggregate({ where: { templateId: template.id }, _max: { sortOrder: true } });
  await prisma.productionTemplateTask.create({
    data: { templateId: template.id, title: parsed.data.title, zone: parsed.data.zone, sortOrder: (last._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json({ templates: await getTemplates() }, { status: 201 });
}
