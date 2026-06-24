'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from './Icons';

function fmt(t: number): string {
  if (!Number.isFinite(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** In-app streaming player: play/pause, scrub bar, elapsed time. No download. */
export function AudioPlayer({ src, label }: { src: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Reset when the source changes (switching parts).
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setFailed(false);
  }, [src]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      // play() rejects (NotSupportedError) when the browser can't decode the
      // source — catch it so it surfaces as a message, not an unhandled error.
      el.play().catch(() => setFailed(true));
    }
  }

  function seek(value: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = value;
    setCurrent(value);
  }

  return (
    <div className="card grain-block p-4">
      <p className="label mb-3">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-white shadow-pop transition active:scale-[0.95]"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause width={22} height={22} /> : <Play width={22} height={22} className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full accent-accent"
            aria-label="Seek"
          />
          <div className="mt-1 flex justify-between text-xs font-semibold text-ink-faint">
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
      {failed && (
        <p className="mt-3 text-xs font-semibold text-rose-500">
          This audio couldn’t be played in your browser.
        </p>
      )}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
