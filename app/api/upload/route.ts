import { NextResponse } from 'next/server';
import { requireLeader } from '@/lib/session';
import { uploadObject, deleteObjects } from '@/lib/supabase';

// Only these top-level prefixes are writable, matching the spec's storage layout.
const ALLOWED_PREFIXES = ['attire/', 'audio/'];

function sanitizeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isAllowed(path: string): boolean {
  if (path.includes('..')) return false;
  return ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

// Browsers (notably Firefox) reject media served with non-standard MIME types
// like `audio/x-m4a`. Pin a standard content-type by extension so playback works
// regardless of what the client's File.type reported.
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  webm: 'audio/webm',
  flac: 'audio/flac',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
};

function contentTypeFor(filename: string, fallback: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPE_BY_EXT[ext] ?? (fallback || 'application/octet-stream');
}

// POST /api/upload — multipart form: file + path (full object key). Leader only.
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const rawPath = form?.get('path');

  if (!(file instanceof File) || typeof rawPath !== 'string') {
    return NextResponse.json({ error: 'file and path are required' }, { status: 400 });
  }

  // Keep the folder, sanitize the final filename segment.
  const segments = rawPath.split('/');
  const filename = sanitizeSegment(segments.pop() ?? 'file');
  const path = [...segments.map(sanitizeSegment), filename].join('/');

  if (!isAllowed(path)) {
    return NextResponse.json({ error: 'Path must be under attire/ or audio/' }, { status: 400 });
  }

  try {
    const buffer = await file.arrayBuffer();
    const url = await uploadObject(path, buffer, contentTypeFor(filename, file.type));
    return NextResponse.json({ url, path }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    );
  }
}

// DELETE /api/upload — body: { path }. Leader only.
export async function DELETE(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const path = body?.path;
  if (typeof path !== 'string' || !isAllowed(path)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  await deleteObjects([path]);
  return NextResponse.json({ ok: true });
}
