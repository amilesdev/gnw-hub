'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChatAttachmentDTO } from '@/lib/chat/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, X } from '@/components/shared/Icons';

/**
 * Full-screen photo/video viewer: swipe between a message's media (native
 * scroll-snap), pinch or double-tap a photo to zoom, drag to pan while zoomed.
 * Arrow keys + Esc on desktop. Long-pressing a photo keeps the phone's own
 * "Save to Photos".
 */
export function MediaViewer({ items, start, onClose }: { items: ChatAttachmentDTO[]; start: number; onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);

  const go = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(items.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  }, [items.length]);

  // Open on the tapped item.
  useEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    };
    // Safari's own page-zoom gesture would fight ours.
    const stop = (e: Event) => e.preventDefault();
    window.addEventListener('keydown', onKey);
    document.addEventListener('gesturestart', stop);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('gesturestart', stop);
    };
  }, [go, onClose, index]);

  function onScroll() {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) {
      setIndex(i);
      // Leaving a slide stops its video.
      el.querySelectorAll('video').forEach((v, vi) => vi !== i && v.pause());
    }
  }

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div className="flex shrink-0 items-center justify-between px-3 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
          <X width={20} height={20} />
        </button>
        {items.length > 1 && (
          <span className="text-sm font-semibold text-white/80">
            {index + 1} / {items.length}
          </span>
        )}
        <span className="w-10" />
      </div>

      <div
        ref={track}
        onScroll={onScroll}
        className={cn('no-scrollbar flex flex-1 snap-x snap-mandatory', zoomed ? 'overflow-hidden' : 'overflow-x-auto')}
      >
        {items.map((a, i) => (
          <div key={a.id} className="relative grid h-full w-full shrink-0 snap-center place-items-center overflow-hidden">
            {a.kind === 'image' ? (
              <ZoomableImage src={a.url} onZoomChange={i === index ? setZoomed : () => {}} />
            ) : (
              <video
                src={a.url}
                poster={a.posterUrl ?? undefined}
                controls
                playsInline
                autoPlay={i === start}
                className="max-h-full max-w-full"
              />
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 justify-between px-3 [@media(hover:hover)]:flex">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous"
            className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-white/15 disabled:opacity-0"
          >
            <ChevronLeft width={22} height={22} />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === items.length - 1}
            aria-label="Next"
            className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-white/15 disabled:opacity-0"
          >
            <ChevronRight width={22} height={22} />
          </button>
        </div>
      )}
      <div className="shrink-0" style={{ height: 'max(1.25rem, env(safe-area-inset-bottom))' }} />
    </div>,
    document.body,
  );
}

const MAX_SCALE = 4;

/** Pinch / double-tap to zoom, drag to pan when zoomed. Unzoomed, horizontal swipes go to the viewer's track. */
function ZoomableImage({ src, onZoomChange }: { src: string; onZoomChange: (z: boolean) => void }) {
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const lastTap = useRef(0);
  const zoomed = t.scale > 1.01;

  useEffect(() => onZoomChange(zoomed), [zoomed, onZoomChange]);

  const set = (scale: number, x: number, y: number) => {
    const s = Math.max(1, Math.min(MAX_SCALE, scale));
    setT(s <= 1.01 ? { scale: 1, x: 0, y: 0 } : { scale: s, x, y });
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed private-bucket URL
    <img
      src={src}
      alt=""
      draggable={false}
      className="max-h-full max-w-full select-none object-contain transition-transform duration-75"
      style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`, touchAction: zoomed ? 'none' : 'pan-x' }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: t.scale };
        }
      }}
      onPointerMove={(e) => {
        const prev = pointers.current.get(e.pointerId);
        if (!prev) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2 && pinch.current) {
          const [a, b] = [...pointers.current.values()];
          set((pinch.current.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist, t.x, t.y);
        } else if (pointers.current.size === 1 && zoomed) {
          set(t.scale, t.x + (e.clientX - prev.x), t.y + (e.clientY - prev.y));
        }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinch.current = null;
        const now = Date.now();
        if (pointers.current.size === 0 && now - lastTap.current < 280) {
          set(zoomed ? 1 : 2.5, 0, 0);
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        pinch.current = null;
      }}
    />
  );
}
