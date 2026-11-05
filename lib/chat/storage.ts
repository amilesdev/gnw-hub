import 'server-only';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';

// Chat photos/videos live in the PRIVATE `gnw-chat` bucket (no public URLs, no
// storage policies — only the service role touches it). The DB stores paths;
// readers get short-lived signed URLs with each page of messages.
//
// Layout: chat/<rootChatId>/<uploaderUserId>/<uuid>.<ext>. Scoping by root
// chat + uploader means a send can only attach files that person uploaded to
// that chat (checked in sendMessage), never someone else's or another chat's.

export const CHAT_BUCKET = process.env.SUPABASE_CHAT_BUCKET ?? 'gnw-chat';

/** Long enough to scroll a session; pages refetch on resume anyway. */
const READ_TTL_SECONDS = 6 * 60 * 60;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
};

export function chatUploadPrefix(rootId: string, userId: string): string {
  return `chat/${rootId}/${userId}/`;
}

export function isOwnChatUpload(path: string, rootId: string, userId: string): boolean {
  return path.startsWith(chatUploadPrefix(rootId, userId)) && !path.includes('..') && /^[\w./-]+$/.test(path);
}

/** A fresh path + signed upload URL the browser PUTs the file to directly (skips Vercel's body cap). */
export async function signChatUpload(rootId: string, userId: string, contentType: string) {
  const ext = EXT_BY_TYPE[contentType] ?? (contentType.startsWith('video/') ? 'mp4' : 'jpg');
  const path = `${chatUploadPrefix(rootId, userId)}${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from(CHAT_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Could not create upload URL: ${error?.message ?? 'unknown error'}`);
  return { path, signedUrl: data.signedUrl };
}

/** Signed read URLs for many paths in one call → path → url (missing ones are left out). */
export async function signChatReads(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const { data, error } = await supabaseAdmin.storage.from(CHAT_BUCKET).createSignedUrls(unique, READ_TTL_SECONDS);
  if (error || !data) return out;
  for (const row of data) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  return out;
}

/** Best-effort delete (a deleted message's or chat's media goes with it). Batched — a whole chat can be thousands. */
export async function deleteChatObjects(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 1000) {
    await supabaseAdmin.storage.from(CHAT_BUCKET).remove(unique.slice(i, i + 1000));
  }
}
