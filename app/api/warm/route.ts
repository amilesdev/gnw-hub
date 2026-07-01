import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Keep-warm probe. A scheduled ping (see .github/workflows/keep-warm.yml) hits
// this every few minutes so the Vercel serverless function stays warm AND the
// Supabase free-tier database — which sleeps after inactivity — stays awake.
// That idle cold-start (function boot + Prisma init + DB waking) is the main
// cause of the slow "first load". Public and read-only: it runs one trivial
// query and returns no data, so it's safe to leave unauthenticated.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true, ts: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, ts: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
