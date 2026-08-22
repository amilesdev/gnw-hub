'use client';

import { useEffect, useState } from 'react';
import { STAGE_BACKDROP } from '@/lib/play/stage-backdrop';

/**
 * The optional house media behind the results stage — see
 * `lib/play/stage-backdrop.ts` for how to point it at a file.
 *
 * Renders nothing at all when no asset is configured, so the painted ground
 * shows through and no bytes are fetched. A video is muted, inline and looping
 * (it is scenery, not content), and a reader who has asked for reduced motion
 * gets the poster still instead of the loop rather than losing the backdrop
 * entirely.
 */
export function StageBackdrop() {
  const { src, kind, poster } = STAGE_BACKDROP;
  const [stillOnly, setStillOnly] = useState(false);

  // Read at mount, not during render: the media query is a browser fact and
  // the server has no opinion about it.
  useEffect(() => {
    setStillOnly(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  }, []);

  if (!src) return null;

  const isVideo = kind === 'video' || /\.(mp4|webm|mov)$/i.test(src);
  // The still to fall back to. A loop with no poster has nothing to show a
  // reduced-motion reader, so that combination drops back to the painted
  // ground rather than to an empty <img>.
  const still = isVideo ? poster : src;
  if ((stillOnly || !isVideo) && !still) return null;

  return (
    <div className="play-backdrop" aria-hidden>
      {isVideo && !stillOnly ? (
        <video src={src} poster={poster} autoPlay muted loop playsInline preload="auto" />
      ) : (
        // A decorative full-bleed backdrop; next/image buys nothing at cover size.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={still} alt="" />
      )}
    </div>
  );
}
