import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { saveStageMapData } from '@/lib/production/server';
import type { StageMapData } from '@/lib/production/types';

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/production/map/items/[deviceId]?mapId=… — remove a quick-added
// device (and its receiver and cables). The seeded setup can't be removed here.
export async function DELETE(req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;
  const mapId = new URL(req.url).searchParams.get('mapId');
  const map = mapId ? await prisma.stageMap.findUnique({ where: { id: mapId } }) : null;
  if (!map) return NextResponse.json({ error: 'Stage map not found' }, { status: 404 });

  const data = map.data as unknown as StageMapData;
  const target = data.devices.find((d) => d.id === id);
  if (!target?.added) return NextResponse.json({ error: 'Only added gear can be removed' }, { status: 400 });

  // A quick-add is "add_<token>" plus, for a wireless mic, "addrx_<token>".
  const token = id.replace(/^addrx?_/, '');
  const gone = new Set([`add_${token}`, `addrx_${token}`]);
  const next: StageMapData = {
    ...data,
    devices: data.devices.filter((d) => !gone.has(d.id)),
    cables: data.cables.filter((c) => !gone.has(c.from[0]) && !gone.has(c.to[0])),
  };
  await saveStageMapData(map.id, next);
  return NextResponse.json({ data: next });
}
