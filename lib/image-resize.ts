'use client';

/**
 * Downscale + center-crop an image File to a square JPEG, in the browser.
 *
 * Profile pictures don't need to be large, and squaring them here keeps every
 * avatar tile consistent regardless of the source aspect ratio. Running it
 * through a <canvas> also transcodes iOS HEIC/HEIF captures to JPEG (which the
 * canvas exports natively) so they display everywhere. The much smaller output
 * also keeps uploads well under any request-size limits.
 *
 * @param file  The user-selected image (camera capture or library pick).
 * @param size  Output edge length in pixels (default 512).
 * @returns A square JPEG File ready to upload.
 */
export async function squareImageFile(file: File, size = 512): Promise<File> {
  const bitmap = await loadBitmap(file);

  // Largest centered square crop of the source.
  const edge = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - edge) / 2;
  const sy = (bitmap.height - edge) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image.');
  ctx.drawImage(bitmap, sx, sy, edge, edge, 0, 0, size, size);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) throw new Error('Could not process the image.');

  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

/** Decode a File to something drawable, preferring the faster createImageBitmap. */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari can't decode HEIC via createImageBitmap; fall through to <img>,
      // which uses the OS decoder.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('That file could not be read as an image.'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
