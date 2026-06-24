import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'gnw-media';

/**
 * Server-only admin client (service role). Use exclusively in API routes /
 * server actions for Storage uploads & deletes. Never import into client code.
 */
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Public URL for a stored object. */
export function publicUrl(path: string): string {
  return supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Upload a file buffer; returns the public URL. */
export async function uploadObject(
  path: string,
  body: ArrayBuffer | Buffer,
  contentType: string,
): Promise<string> {
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return publicUrl(path);
}

/** Delete one or more objects by storage path (best-effort). */
export async function deleteObjects(paths: string[]): Promise<void> {
  if (!paths.length) return;
  await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(paths);
}

/** Extract the storage object path from a public URL (for deletes). */
export function pathFromPublicUrl(publicUrlStr: string): string | null {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = publicUrlStr.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrlStr.slice(idx + marker.length));
}
