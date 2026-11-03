import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { saveStageMapData } from '@/lib/production/server';
import { StageGraph } from '@/lib/production/graph';
import { randomToken } from '@/lib/utils';
import type { StageCable, StageDevice, StageMapData } from '@/lib/production/types';

const schema = z.object({
  mapId: z.string().min(1),
  kind: z.enum(['mic', 'instrument']),
  name: z.string().trim().min(1).max(60),
  wireless: z.boolean().optional(),
  sbIn: z.number().int().min(1).max(32),
  cableType: z.enum(['XLR', 'TRS', 'TS']).optional(),
  power: z.enum(['AC adapter', 'DC adapter']).nullable().optional(),
});

// POST /api/production/map/items — a leader's quick-add ("Add a mic", "Add an
// instrument"). Appends a device (+ a receiver for a wireless mic) and its cable
// into an open stage-box input. Stays on the map every week until removed.
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Give it a name and pick an input' }, { status: 400 });
  const d = parsed.data;

  const map = await prisma.stageMap.findUnique({ where: { id: d.mapId } });
  if (!map) return NextResponse.json({ error: 'Stage map not found' }, { status: 404 });
  const data = map.data as unknown as StageMapData;
  if (!new StageGraph(data).openInputs().includes(d.sbIn)) {
    return NextResponse.json({ error: `Stage box input ${d.sbIn} is already in use` }, { status: 409 });
  }

  const id = randomToken(4);
  const zone = d.kind === 'mic' ? 'mics' : 'instruments';
  const devices: StageDevice[] = [];
  const cables: StageCable[] = [];
  if (d.kind === 'mic' && d.wireless) {
    devices.push({ id: `add_${id}`, name: d.name, model: 'Wireless handheld', kind: 'mic', zone, power: 'Batteries', where: 'With whoever is using it', added: true });
    devices.push({ id: `addrx_${id}`, name: `${d.name} receiver`, short: d.name, model: 'Wireless receiver', kind: 'rx', zone, power: 'DC adapter', where: 'In the receiver stack on the stage box table', prop: 'rx', pairs: d.name, added: true });
    cables.push({ id: `aw_${id}`, zone, from: [`add_${id}`, 'Wireless'], to: [`addrx_${id}`, 'Antenna'], type: 'Wireless', color: 'black', added: true });
    cables.push({ id: `ax_${id}`, zone, from: [`addrx_${id}`, 'Out'], to: ['sb', `In ${d.sbIn}`], type: 'XLR', color: 'black', label: d.name, added: true });
  } else {
    devices.push({
      id: `add_${id}`, name: d.name, model: d.kind === 'mic' ? 'Wired mic' : 'Added instrument', zone,
      power: d.power ?? undefined, where: 'Where it\'s needed', added: true,
    });
    cables.push({ id: `ac_${id}`, zone, from: [`add_${id}`, 'Out'], to: ['sb', `In ${d.sbIn}`], type: d.kind === 'mic' ? 'XLR' : d.cableType ?? 'XLR', color: 'black', label: d.name, added: true });
  }

  const next: StageMapData = { ...data, devices: [...data.devices, ...devices], cables: [...data.cables, ...cables] };
  await saveStageMapData(map.id, next);
  return NextResponse.json({ data: next }, { status: 201 });
}
