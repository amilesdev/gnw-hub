import { NextResponse } from 'next/server';
import { requireLeader } from '@/lib/session';
import { createSignedUpload } from '@/lib/supabase';
import { contentTypeFor, isAllowedPath, sanitizePath } from '@/lib/upload-path';

// POST /api/upload/sign — body: { path }. Leader only.
// Issues a signed URL so the browser can upload the file straight to Supabase
// Storage, avoiding Vercel's ~4.5 MB serverless request-body limit (which shows
// up as a 413 when uploading larger audio/photo files through /api/upload).
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const rawPath = body?.path;
  if (typeof rawPath !== 'string') {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }

  const path = sanitizePath(rawPath);
  if (!isAllowedPath(path)) {
    return NextResponse.json({ error: 'Path must be under attire/ or audio/' }, { status: 400 });
  }

  try {
    const { signedUrl, publicUrl } = await createSignedUpload(path);
    const contentType = contentTypeFor(path.split('/').pop() ?? 'file', '');
    return NextResponse.json({ signedUrl, publicUrl, contentType });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not create upload URL' },
      { status: 500 },
    );
  }
}
