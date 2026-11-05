'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChatAttachmentDTO } from '@/lib/chat/types';
import { ChevronLeft, ChevronRight, X } from '@/components/shared/Icons';
import { useBackClose } from './useBackClose';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** Past an edge (or a zoom limit) a drag moves this fraction of the finger: the iOS rubber band. */
const RUBBER = 0.35;

type Zoom = { s: number; x: number; y: number };
type Pt = { x: number; y: number };
type Mode = 'idle' | 'pending' | 'pan' | 'pinch' | 'swipe' | 'dismiss';

/**
 * Full-screen photo/video viewer, Photos-app style: swipe between a message's
 * media, pinch or double-tap a photo to zoom (around your fingers), drag to pan
 * while zoomed (with rubber-band edges and a little momentum), swipe down to
 * close. Arrow keys, Esc and the wheel / trackpad pinch on desktop. Back swipe
 * closes it too.
 *
 * Every gesture is ours (`touch-action: none` on the stage), so the browser
 * never grabs a pinch halfway through to scroll the strip, and the transforms
 * are written straight to the DOM from refs (no React state per frame), so no
 * finger movement is lost between renders.
 */
export function MediaViewer({ items, start, onClose }: { items: ChatAttachmentDTO[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const indexRef = useRef(start);
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const chrome = useRef<HTMLDivElement>(null);
  const slides = useRef<(HTMLDivElement | null)[]>([]);
  const media = useRef<(HTMLElement | null)[]>([]);
  const zoom = useRef<Zoom>({ s: 1, x: 0, y: 0 });
  const closing = useRef(false);

  const g = useRef({
    pointers: new Map<number, Pt>(),
    mode: 'idle' as Mode,
    start: { x: 0, y: 0 },
    startZoom: { s: 1, x: 0, y: 0 } as Zoom,
    startTime: 0,
    pinchDist: 1,
    pinchMid: { x: 0, y: 0 },
    /** The gesture ever had two fingers down — then it's never a tap. */
    multi: false,
    last: { x: 0, y: 0, t: 0 },
    v: { x: 0, y: 0 },
    dx: 0,
    dy: 0,
  });
  const lastTap = useRef({ t: 0, x: 0, y: 0 });

  useBackClose(onClose);

  // ── DOM writers ─────────────────────────────────────────────────────────────
  const zoomable = (i = indexRef.current) => items[i]?.kind === 'image';

  const stageBox = () => {
    const r = stage.current!.getBoundingClientRect();
    return { w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };

  /** How far a photo at scale s may pan from centre before showing empty space. */
  const limits = (s: number) => {
    const el = media.current[indexRef.current];
    const { w, h } = stageBox();
    if (!el) return { x: 0, y: 0 };
    return { x: Math.max(0, (el.offsetWidth * s - w) / 2), y: Math.max(0, (el.offsetHeight * s - h) / 2) };
  };

  const setZoom = useCallback((z: Zoom, animate: boolean) => {
    zoom.current = z;
    const el = media.current[indexRef.current];
    if (!el) return;
    el.style.transition = animate ? `transform 0.3s ${EASE}` : 'none';
    // Composited while moving; dropped once settled so Safari re-draws it sharp at the new size.
    el.style.willChange = animate ? '' : 'transform';
    el.style.transform = `translate3d(${z.x}px, ${z.y}px, 0) scale(${z.s})`;
  }, []);

  const setTrack = useCallback((dx: number, animate: boolean) => {
    const el = track.current;
    if (!el) return;
    el.style.transition = animate ? `transform 0.32s ${EASE}` : 'none';
    el.style.transform = `translate3d(calc(${-indexRef.current * 100}% + ${dx}px), 0, 0)`;
  }, []);

  const setDismiss = useCallback((dy: number, animate: boolean) => {
    const slide = slides.current[indexRef.current];
    const fade = Math.max(0, 1 - Math.abs(dy) / 400);
    const t = animate ? `0.28s ${EASE}` : '0s';
    if (slide) {
      slide.style.transition = `transform ${t}`;
      slide.style.transform = dy ? `translate3d(0, ${dy}px, 0) scale(${1 - Math.min(0.15, Math.abs(dy) / 2000)})` : '';
    }
    for (const el of [backdrop.current, chrome.current]) {
      if (!el) continue;
      el.style.transition = `opacity ${t}`;
      el.style.opacity = String(fade);
    }
  }, []);

  /** Snap back inside the limits after a pinch/pan (with optional fling momentum). */
  const settle = useCallback(
    (fling: Pt = { x: 0, y: 0 }) => {
      let { s, x, y } = zoom.current;
      if (s <= 1.01) return setZoom({ s: 1, x: 0, y: 0 }, true);
      if (s > MAX_SCALE) {
        x = (x * MAX_SCALE) / s;
        y = (y * MAX_SCALE) / s;
        s = MAX_SCALE;
      }
      const lim = limits(s);
      x = clamp(x + fling.x, -lim.x, lim.x);
      y = clamp(y + fling.y, -lim.y, lim.y);
      setZoom({ s, x, y }, true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- limits reads refs only
    [setZoom],
  );

  const go = useCallback(
    (i: number) => {
      const next = clamp(i, 0, items.length - 1);
      if (next !== indexRef.current) {
        // Leaving a photo resets its zoom; leaving a video pauses it.
        const old = media.current[indexRef.current];
        if (old) {
          old.style.transition = 'none';
          old.style.transform = '';
        }
        zoom.current = { s: 1, x: 0, y: 0 };
        media.current.forEach((el, vi) => vi !== next && el instanceof HTMLVideoElement && el.pause());
        indexRef.current = next;
        setIndex(next);
      }
      setTrack(0, true);
    },
    [items.length, setTrack],
  );

  const close = useCallback(
    (dy = 0) => {
      if (closing.current) return;
      closing.current = true;
      if (dy) setDismiss(Math.sign(dy) * window.innerHeight, true);
      window.setTimeout(onClose, dy ? 200 : 0);
    },
    [onClose, setDismiss],
  );

  // Open on the tapped item.
  useLayoutEffect(() => setTrack(0, false), [setTrack]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') go(indexRef.current + 1);
      if (e.key === 'ArrowLeft') go(indexRef.current - 1);
    };
    // Safari's own page-zoom gesture would fight ours.
    const stop = (e: Event) => e.preventDefault();
    // Desktop: wheel / trackpad pinch zooms around the cursor (native, non-passive so it can't scroll the page).
    const onWheel = (e: WheelEvent) => {
      if (!zoomable()) return;
      e.preventDefault();
      const { cx, cy } = stageBox();
      const p = { x: e.clientX - cx, y: e.clientY - cy };
      const z = zoom.current;
      const s = clamp(z.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), 1, MAX_SCALE);
      const lim = limits(s);
      setZoom(
        {
          s,
          x: clamp(p.x - ((p.x - z.x) * s) / z.s, -lim.x, lim.x),
          y: clamp(p.y - ((p.y - z.y) * s) / z.s, -lim.y, lim.y),
        },
        false,
      );
    };
    const el = stage.current;
    window.addEventListener('keydown', onKey);
    document.addEventListener('gesturestart', stop);
    el?.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('gesturestart', stop);
      el?.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers read refs only
  }, [close, go, setZoom]);

  // ── gestures ────────────────────────────────────────────────────────────────
  const rel = (p: Pt) => {
    const { cx, cy } = stageBox();
    return { x: p.x - cx, y: p.y - cy };
  };

  function beginPinch() {
    const s = g.current;
    const [a, b] = [...s.pointers.values()];
    if (s.mode === 'swipe') setTrack(0, true);
    if (s.mode === 'dismiss') setDismiss(0, true);
    s.mode = 'pinch';
    s.multi = true;
    s.pinchDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    s.pinchMid = rel({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    s.startZoom = { ...zoom.current };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (closing.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // Leave a video's own control bar (play/scrub) to the video.
    const target = e.target as HTMLElement;
    if (target instanceof HTMLVideoElement && e.clientY > target.getBoundingClientRect().bottom - 72) return;
    const s = g.current;
    stage.current?.setPointerCapture?.(e.pointerId);
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pointers.size === 1) {
      s.mode = 'pending';
      s.multi = false;
      s.start = { x: e.clientX, y: e.clientY };
      s.startZoom = { ...zoom.current };
      s.startTime = performance.now();
      s.last = { x: e.clientX, y: e.clientY, t: s.startTime };
      s.v = { x: 0, y: 0 };
      s.dx = s.dy = 0;
    } else if (s.pointers.size === 2 && zoomable()) {
      beginPinch();
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = g.current;
    if (!s.pointers.has(e.pointerId)) return;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Fling speed only means something for one finger (two fingers' events interleave).
    if (s.pointers.size === 1) {
      const now = performance.now();
      const dt = Math.max(1, now - s.last.t);
      s.v = { x: (e.clientX - s.last.x) / dt, y: (e.clientY - s.last.y) / dt };
      s.last = { x: e.clientX, y: e.clientY, t: now };
    }

    if (s.mode === 'pinch') {
      if (s.pointers.size < 2) return;
      const [a, b] = [...s.pointers.values()];
      const mid = rel({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      let scale = (s.startZoom.s * Math.hypot(a.x - b.x, a.y - b.y)) / s.pinchDist;
      if (scale < 1) scale = 1 - (1 - scale) * RUBBER;
      if (scale > MAX_SCALE) scale = MAX_SCALE + (scale - MAX_SCALE) * RUBBER;
      // Keep the photo point that was under the fingers under them.
      const q = { x: (s.pinchMid.x - s.startZoom.x) / s.startZoom.s, y: (s.pinchMid.y - s.startZoom.y) / s.startZoom.s };
      setZoom({ s: scale, x: mid.x - scale * q.x, y: mid.y - scale * q.y }, false);
      return;
    }

    const dx = e.clientX - s.start.x;
    const dy = e.clientY - s.start.y;
    if (s.mode === 'pending') {
      if (Math.hypot(dx, dy) < 8) return;
      if (zoom.current.s > 1.01) s.mode = 'pan';
      else if (Math.abs(dx) > Math.abs(dy)) s.mode = 'swipe';
      else s.mode = 'dismiss';
    }

    if (s.mode === 'pan') {
      const z = zoom.current;
      const lim = limits(z.s);
      setZoom({ s: z.s, x: rubber(s.startZoom.x + dx, lim.x), y: rubber(s.startZoom.y + dy, lim.y) }, false);
    } else if (s.mode === 'swipe') {
      const atEdge = (indexRef.current === 0 && dx > 0) || (indexRef.current === items.length - 1 && dx < 0);
      s.dx = atEdge ? dx * RUBBER : dx;
      setTrack(s.dx, false);
    } else if (s.mode === 'dismiss') {
      s.dy = dy;
      setDismiss(dy, false);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const s = g.current;
    if (!s.pointers.delete(e.pointerId)) return;

    if (s.mode === 'pinch') {
      if (s.pointers.size === 1) {
        // One finger left: carry on as a pan from here.
        const [p] = [...s.pointers.values()];
        s.mode = 'pan';
        s.start = { ...p };
        s.startZoom = { ...zoom.current };
        s.last = { ...p, t: performance.now() };
        s.v = { x: 0, y: 0 };
      } else if (s.pointers.size === 0) {
        s.mode = 'idle';
        settle();
      }
      return;
    }
    if (s.pointers.size > 0) return;

    const mode = s.mode;
    s.mode = 'idle';
    if (mode === 'pending' && e.type === 'pointerup' && !s.multi && performance.now() - s.startTime < 300) {
      tap({ x: e.clientX, y: e.clientY });
    } else if (mode === 'pan') {
      // A flick keeps gliding a little, then settles inside the edges.
      settle({ x: s.v.x * 140, y: s.v.y * 140 });
    } else if (mode === 'swipe') {
      const w = stageBox().w;
      if ((s.dx < -w * 0.22 || s.v.x < -0.45) && indexRef.current < items.length - 1) go(indexRef.current + 1);
      else if ((s.dx > w * 0.22 || s.v.x > 0.45) && indexRef.current > 0) go(indexRef.current - 1);
      else setTrack(0, true);
    } else if (mode === 'dismiss') {
      if (Math.abs(s.dy) > 110 || Math.abs(s.v.y) > 0.6) close(s.dy || s.v.y);
      else setDismiss(0, true);
    }
  }

  function tap(p: Pt) {
    const now = performance.now();
    const prev = lastTap.current;
    if (now - prev.t < DOUBLE_TAP_MS && Math.hypot(p.x - prev.x, p.y - prev.y) < 40 && zoomable()) {
      lastTap.current = { t: 0, x: 0, y: 0 };
      if (zoom.current.s > 1.01) return setZoom({ s: 1, x: 0, y: 0 }, true);
      // Zoom in on the spot that was tapped.
      const r = rel(p);
      const lim = limits(DOUBLE_TAP_SCALE);
      setZoom(
        {
          s: DOUBLE_TAP_SCALE,
          x: clamp(r.x * (1 - DOUBLE_TAP_SCALE), -lim.x, lim.x),
          y: clamp(r.y * (1 - DOUBLE_TAP_SCALE), -lim.y, lim.y),
        },
        true,
      );
      return;
    }
    lastTap.current = { t: now, x: p.x, y: p.y };
  }

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex animate-fade-in flex-col text-white" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div ref={backdrop} className="absolute inset-0 bg-black" aria-hidden />
      <div
        ref={chrome}
        className="relative z-10 flex shrink-0 items-center justify-between px-3 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <button type="button" onClick={() => close()} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
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
        ref={stage}
        className="relative flex-1 touch-none select-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={track} className="flex h-full">
          {items.map((a, i) => (
            <div
              key={a.id}
              ref={(el) => {
                slides.current[i] = el;
              }}
              className="grid h-full w-full shrink-0 place-items-center overflow-hidden"
            >
              {a.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed private-bucket URL
                <img
                  ref={(el) => {
                    media.current[i] = el;
                  }}
                  src={a.url}
                  alt=""
                  draggable={false}
                  className="max-h-full max-w-full origin-center object-contain"
                />
              ) : (
                <video
                  ref={(el) => {
                    media.current[i] = el;
                  }}
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
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label="Previous"
              className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-white/15 disabled:opacity-0"
            >
              <ChevronLeft width={22} height={22} />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => go(index + 1)}
              disabled={index === items.length - 1}
              aria-label="Next"
              className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-white/15 disabled:opacity-0"
            >
              <ChevronRight width={22} height={22} />
            </button>
          </div>
        )}
      </div>
      <div className="relative shrink-0" style={{ height: 'max(1.25rem, env(safe-area-inset-bottom))' }} />
    </div>,
    document.body,
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Free inside ±limit; past it, resist. */
function rubber(v: number, limit: number): number {
  if (v > limit) return limit + (v - limit) * RUBBER;
  if (v < -limit) return -limit + (v + limit) * RUBBER;
  return v;
}
