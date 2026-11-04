import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCrossover } from '@/lib/crossover-guard';
import { parseProgram, parseTimed } from '@/lib/crossover-schedule';

const timedSchema = z
  .array(
    z.object({
      time: z.string().max(8).default(''),
      label: z.string().trim().max(200).default(''),
      note: z.string().trim().max(300).optional(),
    }),
  )
  .max(60)
  // Fully empty rows (added but never filled in) aren't saved.
  .transform((rows) => rows.filter((r) => r.time || r.label).map((r) => (r.note ? r : { time: r.time, label: r.label })));

const programSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(40),
      setId: z.string().min(1).max(40).optional(),
      label: z.string().trim().max(200).optional(),
      cue: z.string().trim().max(200).optional(),
    }),
  )
  .max(60)
  .transform((items) => items.filter((i) => i.setId || i.label));

const patchSchema = z.object({
  dayOf: timedSchema.optional(),
  dress: timedSchema.optional(),
  program: programSchema.optional(),
});

function payload(s: { dayOfSchedule: unknown; dressSchedule: unknown; program: unknown }) {
  return { dayOf: parseTimed(s.dayOfSchedule), dress: parseTimed(s.dressSchedule), program: parseProgram(s.program) };
}

// GET /api/crossover/schedule — the day-of and Dress Rehearsal schedules and the program.
export async function GET() {
  const guard = await requireCrossover();
  if ('error' in guard) return guard.error;
  return NextResponse.json(payload(guard.season));
}

// PATCH /api/crossover/schedule { dayOf?, dress?, program? } — replace any of
// them whole. Leader only. Program set rows must point at this season's sets.
export async function PATCH(req: Request) {
  const guard = await requireCrossover({ leader: true });
  if ('error' in guard) return guard.error;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const d = parsed.data;

  if (d.program) {
    const setIds = [...new Set(d.program.map((i) => i.setId).filter((x): x is string => !!x))];
    const owned = await prisma.crossoverSet.count({ where: { seasonId: guard.season.id, id: { in: setIds } } });
    if (owned !== setIds.length) {
      return NextResponse.json({ error: 'The program names a set that isn’t in this season.' }, { status: 400 });
    }
  }

  const season = await prisma.crossoverSeason.update({
    where: { id: guard.season.id },
    data: {
      ...(d.dayOf ? { dayOfSchedule: d.dayOf } : {}),
      ...(d.dress ? { dressSchedule: d.dress } : {}),
      ...(d.program ? { program: d.program } : {}),
    },
  });
  return NextResponse.json(payload(season));
}
