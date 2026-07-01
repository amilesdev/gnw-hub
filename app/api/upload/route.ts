import { NextResponse } from 'next/server';
import { requireLeader } from '@/lib/session';
import { uploadObject, deleteObjects } from '@/lib/supabase';
import { contentTypeFor, isAllowedPath, sanitizePath } from '@/lib/upload-path';

// POST /api/upload — multipart form: file + path (full object key). Leader only.
// NOTE: this routes the file body through the serverless function, which caps
// request bodies at ~4.5 MB on Vercel. Larger files must use the signed-upload
// flow (`/api/upload/sign` + direct-to-Storage PUT); see lib/upload-client.ts.
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const rawPath = form?.get('path');

  if (!(file instanceof File) || typeof rawPath !== 'string') {
    return NextResponse.json({ error: 'file and path are required' }, { status: 400 });
  }

  const path = sanitizePath(rawPath);
  const filename = path.split('/').pop() ?? 'file';

  if (!isAllowedPath(path)) {
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
  if (typeof path !== 'string' || !isAllowedPath(path)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  await deleteObjects([path]);
  return NextResponse.json({ ok: true });
}
