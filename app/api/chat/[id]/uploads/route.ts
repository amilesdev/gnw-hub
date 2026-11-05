import { NextResponse } from 'next/server';
import { archivedError, requireChat } from '@/lib/chat/guard';
import { signChatUpload } from '@/lib/chat/storage';
import { chatUploadSchema, firstIssue } from '@/lib/chat/validation';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/chat/[id]/uploads { files: [{ type, size }] } — one signed upload
// URL per file, into this chat's folder in the private gnw-chat bucket, scoped
// to the uploader. The browser PUTs each file straight to Storage (skipping
// Vercel's ~4.5 MB body cap), then sends the message with the returned paths.
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireChat((await params).id);
  if ('error' in guard) return guard.error;
  const blocked = archivedError(guard.access);
  if (blocked) return blocked;

  const parsed = chatUploadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });

  try {
    const uploads = await Promise.all(
      parsed.data.files.map((f) => signChatUpload(guard.access.root.id, guard.user.id, f.type)),
    );
    return NextResponse.json({ uploads });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not start the upload.' }, { status: 500 });
  }
}
