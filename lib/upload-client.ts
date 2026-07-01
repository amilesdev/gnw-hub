'use client';

import { apiFetch } from './api-client';

/**
 * Upload a file to Supabase Storage from the browser via a server-issued signed
 * URL. The file goes straight to Storage rather than through the Next.js API
 * route, so it isn't subject to Vercel's ~4.5 MB serverless request-body limit
 * (which was surfacing as "Request failed (413)" for larger audio/photos).
 * Returns the public URL of the stored object.
 */
export async function uploadFile(path: string, file: File): Promise<string> {
  const { signedUrl, publicUrl, contentType } = await apiFetch<{
    signedUrl: string;
    publicUrl: string;
    contentType: string;
  }>('/api/upload/sign', { method: 'POST', body: JSON.stringify({ path }) });

  const res = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    // `x-upsert` lets a re-upload replace an existing object (e.g. "Replace").
    headers: { 'content-type': contentType, 'x-upsert': 'true' },
  });

  if (!res.ok) {
    if (res.status === 413) throw new Error('That file is too large to upload.');
    let message = `Upload failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message || data?.error) message = String(data.message ?? data.error);
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  return publicUrl;
}
