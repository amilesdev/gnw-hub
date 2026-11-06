'use client';

import { apiFetch } from './api-client';

/**
 * Upload a file to Supabase Storage from the browser via a server-issued signed
 * URL. The file goes straight to Storage rather than through the Next.js API
 * route, so it isn't subject to Vercel's ~4.5 MB serverless request-body limit
 * (which was surfacing as "Request failed (413)" for larger audio/photos).
 * Returns the public URL of the stored object.
 *
 * `onProgress` gets 0–100 as the bytes go up ("Uploading 42%"), which is why
 * this is an XHR rather than fetch: fetch has no upload progress events.
 */
export async function uploadFile(path: string, file: File, onProgress?: (pct: number) => void): Promise<string> {
  const { signedUrl, publicUrl, contentType } = await apiFetch<{
    signedUrl: string;
    publicUrl: string;
    contentType: string;
  }>('/api/upload/sign', { method: 'POST', body: JSON.stringify({ path }) });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('content-type', contentType);
    // `x-upsert` lets a re-upload replace an existing object (e.g. "Replace").
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      if (xhr.status === 413) return reject(new Error('That file is too large to upload.'));
      let message = `Upload failed (${xhr.status})`;
      try {
        const data = JSON.parse(xhr.responseText);
        if (data?.message || data?.error) message = String(data.message ?? data.error);
      } catch {
        /* non-JSON error body */
      }
      reject(new Error(message));
    };
    xhr.send(file);
  });

  return publicUrl;
}
