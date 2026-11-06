'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { SongDTO } from '@/lib/setlist-serialize';

// A single, app-wide audio element that outlives the song sheet. Playback is
// started from a part row but keeps going as the member closes the sheet and
// scrolls the setlist — the MiniPlayer bar (in the dock) is the persistent
// transport. The <audio> lives here, in the layout-level shell, so navigating
// between Home / Events / Songs / Profile never interrupts the track.

export type AudioTrack = {
  /** Which row this is ("{songId}:{part}"), so a reopened sheet shows it active. */
  id: string;
  /** Streaming URL for the selected part. */
  src: string;
  /** Song title, e.g. "Goodness of God". */
  title: string;
  /** Part label, e.g. "Alto". */
  part: string;
  /** The song + where it was opened from, so the MiniPlayer can reopen its sheet. */
  song?: SongDTO;
  context?: SongSheetContext;
};

/** Where a song sheet was opened from: its back pill and eyebrow. */
export type SongSheetContext = { backLabel?: string; eyebrow?: string; fromLibrary?: boolean };

type AudioContextValue = {
  track: AudioTrack | null;
  playing: boolean;
  current: number;
  duration: number;
  failed: boolean;
  loop: boolean;
  play: (track: AudioTrack) => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  restart: () => void;
  toggleLoop: () => void;
  stop: () => void;
};

const AudioCtx = createContext<AudioContextValue | null>(null);

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be used within an AudioProvider');
  return ctx;
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loop, setLoop] = useState(false);

  const play = useCallback((next: AudioTrack) => {
    setFailed(false);
    setCurrent(0);
    setDuration(0);
    setTrack(next);
    const el = audioRef.current;
    if (!el) return;
    el.src = next.src;
    // Started from a user tap, so autoplay is permitted; surface decode failures.
    el.play().catch(() => setFailed(true));
  }, []);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || !track) return;
    if (el.paused) el.play().catch(() => setFailed(true));
    else el.pause();
  }, [track]);

  const seek = useCallback((seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = seconds;
    setCurrent(seconds);
  }, []);

  const restart = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    setCurrent(0);
    if (el.paused) el.play().catch(() => setFailed(true));
  }, []);

  // Loop stays on across parts until turned off, so drilling one part over and
  // over and then switching to the next keeps the same habit.
  const toggleLoop = useCallback(() => {
    setLoop((on) => {
      if (audioRef.current) audioRef.current.loop = !on;
      return !on;
    });
  }, []);

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    setTrack(null);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setFailed(false);
  }, []);

  return (
    <AudioCtx.Provider
      value={{ track, playing, current, duration, failed, loop, play, toggle, seek, restart, toggleLoop, stop }}
    >
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        loop={loop}
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
        // Ignore the error that fires when we intentionally clear the source on stop.
        onError={(e) => {
          if (e.currentTarget.currentSrc) setFailed(true);
        }}
      />
    </AudioCtx.Provider>
  );
}
