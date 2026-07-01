import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireLeader } from '@/lib/session';
import { AUDIO_PARTS } from '@/lib/setlist-serialize';
import { deleteObjects, pathFromPublicUrl } from '@/lib/supabase';
import { revalidateSetlists } from '@/lib/cache-tags';

type Ctx = { params: Promise<{ id: string }> };

const lyricChartSchema = z.object({
  title: z.string(),
  lines: z.array(
    z.object({
      type: z.enum(['section', 'lyric', 'blank']),
      text: z.string(),
      bold: z.boolean(),
    }),
  ),
  parsedAt: z.string(),
});

const patchSchema = z.object({
  songTitle: z.string().min(1).max(200).optional(),
  youtubeLink: z.string().nullable().optional(),
  driveLink: z.string().nullable().optional(),
  audioSoprano: z.string().nullable().optional(),
  audioAlto: z.string().nullable().optional(),
  audioTenor: z.string().nullable().optional(),
  audioAllParts: z.string().nullable().optional(),
  // Lyric chart import: set both together, or null both to clear.
  lyricChart: lyricChartSchema.nullable().optional(),
  lyricDocUrl: z.string().nullable().optional(),
});

// PATCH /api/songs/[id] — set/replace/clear a song's fields & audio slots. Leader only.
// Setting an audio field to a new value or null deletes the previously stored file.
export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  const { id } = await params;

  const existing = await prisma.song.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Song not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const d = parsed.data;

  // Clean up any audio file that's being replaced or cleared.
  const stale: string[] = [];
  for (const part of AUDIO_PARTS) {
    if (d[part] !== undefined && existing[part] && d[part] !== existing[part]) {
      const p = pathFromPublicUrl(existing[part]!);
      if (p) stale.push(p);
    }
  }
  if (stale.length) await deleteObjects(stale);

  const song = await prisma.song.update({
    where: { id },
    data: {
      ...(d.songTitle !== undefined ? { songTitle: d.songTitle } : {}),
      ...(d.youtubeLink !== undefined ? { youtubeLink: d.youtubeLink || null } : {}),
      ...(d.driveLink !== undefined ? { driveLink: d.driveLink || null } : {}),
      ...(d.audioSoprano !== undefined ? { audioSoprano: d.audioSoprano || null } : {}),
      ...(d.audioAlto !== undefined ? { audioAlto: d.audioAlto || null } : {}),
      ...(d.audioTenor !== undefined ? { audioTenor: d.audioTenor || null } : {}),
      ...(d.audioAllParts !== undefined ? { audioAllParts: d.audioAllParts || null } : {}),
      // Stamp the import time whenever a chart is set; clear it when removed.
      ...(d.lyricChart !== undefined
        ? { lyricChart: d.lyricChart ?? Prisma.DbNull, lyricChartUpdatedAt: d.lyricChart ? new Date() : null }
        : {}),
      ...(d.lyricDocUrl !== undefined ? { lyricDocUrl: d.lyricDocUrl || null } : {}),
    },
  });

  revalidateSetlists();
  return NextResponse.json({ song });
}
