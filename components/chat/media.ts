'use client';

import { fitImageFile } from '@/lib/image-resize';
import { apiFetch } from '@/lib/api-client';
import { CHAT_MEDIA_MAX_BYTES, type ChatMediaKind } from '@/lib/chat/types';

// Browser side of chat photos/videos/PDFs: shrink photos, grab a video's
// poster frame (PDFs go as they are), then PUT each file straight to the
// private bucket via a signed URL (with progress — fetch can't report upload
// progress, so this uses XHR).

const PHOTO_MAX_EDGE = 2048;

export type PreparedMedia = {
  kind: ChatMediaKind;
  file: File;
  /** Video poster frame (JPEG), grabbed client-side. */
  poster: File | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
};

export function mediaKindOf(file: File): ChatMediaKind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type === 'application/pdf') return 'file';
  // iOS sometimes hands over HEIC/MOV with an empty type — go by extension.
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['heic', 'heif', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (['mov', 'mp4', 'm4v', 'webm'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'file';
  return null;
}

/** Why a picked file can't be sent, or null if it's fine. */
export function mediaProblem(file: File): string | null {
  if (!mediaKindOf(file)) return `“${file.name}” isn’t a photo, video or PDF.`;
  if (file.size > CHAT_MEDIA_MAX_BYTES) return `“${file.name}” is over 100 MB.`;
  return null;
}

export async function prepareMedia(file: File): Promise<PreparedMedia> {
  const kind = mediaKindOf(file)!;
  if (kind === 'file') {
    // Sent untouched; the type is pinned so the signed upload gets a .pdf path.
    return { kind, file: new File([file], file.name || 'document.pdf', { type: 'application/pdf' }), poster: null, width: null, height: null, durationSec: null };
  }
  if (kind === 'image') {
    // GIFs keep their animation; everything else is resized to JPEG (also turns HEIC into JPEG).
    const out = file.type === 'image/gif' ? file : await fitImageFile(file, PHOTO_MAX_EDGE).catch(() => file);
    const dims = await imageSize(out);
    return { kind, file: renamed(out, 'photo'), poster: null, ...dims, durationSec: null };
  }
  const meta = await videoMeta(file);
  const type = file.type || 'video/quicktime';
  return { kind, file: new File([file], file.name || 'video.mov', { type }), ...meta };
}

function renamed(f: File, base: string): File {
  const ext = f.type === 'image/gif' ? 'gif' : f.type === 'image/png' ? 'png' : 'jpg';
  return new File([f], `${base}.${ext}`, { type: f.type || 'image/jpeg' });
}

async function imageSize(file: File): Promise<{ width: number | null; height: number | null }> {
  try {
    const bmp = await createImageBitmap(file);
    const out = { width: bmp.width, height: bmp.height };
    bmp.close();
    return out;
  } catch {
    return { width: null, height: null };
  }
}

/** Size, duration and a poster frame, from a hidden <video>. Best-effort: a failure just means no poster. */
function videoMeta(file: File): Promise<Omit<PreparedMedia, 'kind' | 'file'>> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    let done = false;
    const finish = (poster: File | null) => {
      if (done) return;
      done = true;
      const out = {
        poster,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        durationSec: Number.isFinite(video.duration) ? Math.round(video.duration * 10) / 10 : null,
      };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    const timer = window.setTimeout(() => finish(null), 8000);
    video.onloadeddata = () => {
      // A frame a little in, so it isn't a black fade-in.
      video.currentTime = Math.min(0.5, (video.duration || 1) / 4);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            window.clearTimeout(timer);
            finish(blob ? new File([blob], 'poster.jpg', { type: 'image/jpeg' }) : null);
          },
          'image/jpeg',
          0.8,
        );
      } catch {
        window.clearTimeout(timer);
        finish(null);
      }
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    video.src = url;
  });
}

/** Ask the server for signed upload URLs (one per file) in this chat. */
export async function signUploads(chatId: string, files: File[]): Promise<{ path: string; signedUrl: string }[]> {
  const { uploads } = await apiFetch<{ uploads: { path: string; signedUrl: string }[] }>(`/api/chat/${chatId}/uploads`, {
    method: 'POST',
    body: JSON.stringify({ files: files.map((f) => ({ type: f.type || 'application/octet-stream', size: f.size })) }),
  });
  return uploads;
}

/** PUT a file to its signed URL, reporting progress 0→1. */
export function putWithProgress(signedUrl: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    // Short CDN cache: signed URLs change every time they're issued, so long
    // caching buys nothing — and a deleted photo shouldn't linger at the edge.
    xhr.setRequestHeader('cache-control', 'max-age=300');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(xhr.status === 413 ? 'That file is too large.' : `Upload failed (${xhr.status}).`));
    xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
    xhr.send(file);
  });
}

/** "840 KB", "2.3 MB" */
export function formatBytes(n: number | null | undefined): string {
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** "1:05" */
export function formatDuration(sec: number | null): string {
  if (sec === null) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
