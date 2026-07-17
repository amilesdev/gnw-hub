import { NextResponse } from 'next/server';
import { requireLeader, requireUser } from '@/lib/session';
import { createSignedUpload } from '@/lib/supabase';
import {
  AVATAR_PREFIX,
  contentTypeFor,
  isAllowedPath,
  isOwnAvatarPath,
  sanitizePath,
} from '@/lib/upload-path';

// POST /api/upload/sign — body: { path }.
// Issues a signed URL so the browser can upload the file straight to Supabase
// Storage, avoiding Vercel's ~4.5 MB serverless request-body limit (which shows
// up as a 413 when uploading larger audio/photo files through /api/upload).
//
// Authorization depends on the target prefix:
//   • `avatars/<userId>/…` — any authenticated member, but only into their OWN
//     folder (profile pictures).
//   • everything else (attire/, audio/) — leaders only, as before.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rawPath = body?.path;
  if (typeof rawPath !== 'string') {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }

  const path = sanitizePath(rawPath);
  if (!isAllowedPath(path)) {
    return NextResponse.json(
      { error: 'Path must be under attire/, audio/, or avatars/' },
      { status: 400 },
    );
  }

  if (path.startsWith(AVATAR_PREFIX)) {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    if (!isOwnAvatarPath(path, guard.user.id)) {
      return NextResponse.json({ error: 'You can only upload your own avatar.' }, { status: 403 });
    }
  } else {
    const guard = await requireLeader();
    if ('error' in guard) return guard.error;
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
