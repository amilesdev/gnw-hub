import { NextResponse } from 'next/server';
import { z } from 'zod';
import { google } from 'googleapis';
import { requireLeader } from '@/lib/session';
import { parseGoogleDoc } from '@/lib/parseGoogleDoc';

const bodySchema = z.object({ docUrl: z.string().min(1) });

// GET /api/parse-lyric-doc — surface the service-account email so the import
// panel can tell leaders which address to share their docs with. Leader only.
export async function GET() {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;
  return NextResponse.json({ serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null });
}

// POST /api/parse-lyric-doc — fetch a Google Doc via the service account, parse
// its structure into a LyricChart, and return it. Leader only. The doc must be
// shared with GOOGLE_SERVICE_ACCOUNT_EMAIL.
export async function POST(req: Request) {
  const guard = await requireLeader();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid Google Doc URL.' }, { status: 400 });
  }

  const { docUrl } = parsed.data;
  const match = docUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  const docId = match?.[1];
  if (!docId) {
    return NextResponse.json({ success: false, error: 'Invalid Google Doc URL.' }, { status: 400 });
  }

  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!serviceEmail || !privateKey) {
    return NextResponse.json(
      { success: false, error: 'Google service account is not configured on the server.' },
      { status: 500 },
    );
  }

  try {
    const auth = new google.auth.JWT({
      email: serviceEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/documents.readonly'],
    });
    const docs = google.docs({ version: 'v1', auth });
    const res = await docs.documents.get({ documentId: docId });

    const chart = parseGoogleDoc(res.data);
    if (chart.lines.length === 0) {
      return NextResponse.json(
        { success: false, error: 'This document looks empty — nothing to import.' },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, chart });
  } catch (e) {
    // googleapis throws a GaxiosError carrying the real reason from Google.
    const err = e as {
      code?: number;
      response?: { data?: { error?: { code?: number; status?: string; message?: string } } };
    };
    const httpCode = err.response?.data?.error?.code ?? err.code;
    const googleMsg = err.response?.data?.error?.message ?? '';
    const googleStatus = err.response?.data?.error?.status ?? '';

    // The Docs API not being enabled in the project also returns 403, but the
    // message says so — surface that distinctly so it isn't mistaken for sharing.
    if (/has not been used|is disabled|SERVICE_DISABLED/i.test(googleMsg)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'The Google Docs API is not enabled for this service account’s project. Enable it in Google Cloud Console, then try again.',
        },
        { status: 403 },
      );
    }

    if (httpCode === 404) {
      return NextResponse.json(
        { success: false, error: 'Document not found. Double-check the Google Doc URL.' },
        { status: 404 },
      );
    }

    if (httpCode === 403 || googleStatus === 'PERMISSION_DENIED') {
      return NextResponse.json(
        {
          success: false,
          error: `Could not access this document. Make sure it's shared with ${serviceEmail}.`,
        },
        { status: 403 },
      );
    }

    const message = googleMsg || (e instanceof Error ? e.message : 'Could not import this document.');
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
