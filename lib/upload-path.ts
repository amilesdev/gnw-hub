// Shared storage-path validation + content-type rules, used by both the
// (small-file) multipart upload route and the signed-upload-URL route.

// Only these top-level prefixes are writable, matching the spec's storage layout.
export const ALLOWED_PREFIXES = ['attire/', 'audio/'];

export function sanitizeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Sanitize each path segment, keeping the folder structure intact. */
export function sanitizePath(rawPath: string): string {
  const segments = rawPath.split('/');
  const filename = sanitizeSegment(segments.pop() ?? 'file');
  return [...segments.map(sanitizeSegment), filename].join('/');
}

export function isAllowedPath(path: string): boolean {
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

export function contentTypeFor(filename: string, fallback: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPE_BY_EXT[ext] ?? (fallback || 'application/octet-stream');
}
