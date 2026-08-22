'use client';

// Lightweight SFX player. Files live in /public/sounds (see the audio manifest).
// Missing files fail silently, so the game works before assets are dropped in.
const cache = new Map<string, HTMLAudioElement>();

export type Sfx =
  | 'game-start'
  | 'countdown-tick'
  | 'countdown-final'
  | 'round-end'
  | 'answer-correct'
  | 'answer-wrong'
  | 'heart-lost'
  | 'elimination'
  | 'celebration-music'
  | 'podium-land';

/**
 * Warm the cache for cues that have to fire on an exact frame.
 *
 * Without this, the first `playSfx` for a cue constructs the Audio element and
 * starts fetching right at the moment it's needed — 100–500ms of buffering on
 * mobile data, which is precisely the window where a countdown drifts away from
 * its numbers. Call it a few seconds before the cue is due (lobby mount for the
 * game-start countdown, live-game mount for the round cues).
 *
 * Deliberately NOT used for the lobby playlist: those are the large files, they
 * start the moment the lobby mounts anyway, and they stream progressively.
 * `startLobbyMusic` does its own one-track-ahead preloading.
 */
export function preloadSfx(...names: Sfx[]): void {
  if (typeof window === 'undefined') return;
  for (const name of names) {
    if (cache.has(name)) continue;
    try {
      const el = new Audio(`/sounds/${name}.mp3`);
      el.preload = 'auto';
      el.load();
      cache.set(name, el);
    } catch {
      /* a missing file must never break the screen that wanted it */
    }
  }
}

export function playSfx(name: Sfx, opts?: { loop?: boolean; volume?: number }): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  try {
    let el = cache.get(name);
    if (!el) {
      el = new Audio(`/sounds/${name}.mp3`);
      cache.set(name, el);
    }
    el.loop = opts?.loop ?? false;
    el.volume = opts?.volume ?? 1;
    el.currentTime = 0;
    void el.play().catch(() => {});
    return el;
  } catch {
    return null;
  }
}

export function stopSfx(name: Sfx): void {
  const el = cache.get(name);
  if (el) {
    el.pause();
    el.currentTime = 0;
  }
}

/* ------------------------------------------------------------------ *
 * Lobby music: a shuffled, never-ending playlist.
 * ------------------------------------------------------------------ */

const LOBBY_TRACKS = [
  'lobby-music-fill-the-room',
  'lobby-music-great-jehovah',
  'lobby-music-joy-is-coming',
  'lobby-music-open-the-eyes',
  'lobby-music-praise',
];

/**
 * How long the outgoing and incoming tracks overlap, and how often the fade
 * steps. The overlap is what makes the handover gapless: waiting for `ended`
 * before calling `play()` on the next element leaves an audible hole (the
 * browser has to flip elements, and every mp3 carries encoder padding at both
 * ends). Starting the next track a beat early and riding the two volumes past
 * each other covers all of that.
 */
const CROSSFADE_S = 1.2;
const FADE_STEP_MS = 50;
/** Watchdog cadence — only has to be well under CROSSFADE_S. */
const WATCH_MS = 200;

type LobbyMusic = {
  /** Upcoming track names; refilled a shuffled cycle at a time. */
  queue: string[];
  playing: string | null;
  current: HTMLAudioElement | null;
  /** The next track, already fetching, so the handover costs nothing. */
  next: HTMLAudioElement | null;
  /** Full volume for the playlist; fades move elements between 0 and this. */
  volume: number;
  watchdog: ReturnType<typeof setInterval> | null;
  fades: Set<ReturnType<typeof setInterval>>;
  /** Set while a handover is in flight so it can't fire twice. */
  handingOver: boolean;
  /** Removes the "resume on first tap" listeners, if autoplay was blocked. */
  unlock: (() => void) | null;
};

let lobby: LobbyMusic | null = null;

/** A fresh random cycle of every track, never opening with `avoid`. */
function shuffleTracks(avoid?: string | null): string[] {
  const a = [...LOBBY_TRACKS];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (avoid && a[0] === avoid && a.length > 1) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

/** Keep at least one track queued past the one we're about to hand to. */
function refillQueue(s: LobbyMusic): void {
  if (s.queue.length > 1) return;
  s.queue.push(...shuffleTracks(s.queue[s.queue.length - 1] ?? s.playing));
}

function makeTrack(name: string, volume: number): HTMLAudioElement {
  const el = new Audio(`/sounds/${name}.mp3`);
  el.preload = 'auto';
  el.volume = volume;
  el.load();
  return el;
}

function fadeTo(s: LobbyMusic, el: HTMLAudioElement, target: number, onDone?: () => void): void {
  const step = (s.volume / (CROSSFADE_S * 1000)) * FADE_STEP_MS;
  const id = setInterval(() => {
    const delta = target - el.volume;
    if (Math.abs(delta) <= step) {
      el.volume = target;
      clearInterval(id);
      s.fades.delete(id);
      onDone?.();
      return;
    }
    // Clamp: a volume outside [0,1] throws.
    el.volume = Math.min(1, Math.max(0, el.volume + Math.sign(delta) * step));
  }, FADE_STEP_MS);
  s.fades.add(id);
}

/** Start `el`, and if autoplay is blocked, try again on the first interaction. */
function startTrack(s: LobbyMusic, el: HTMLAudioElement): void {
  void el.play().catch(() => {
    if (s.unlock) return;
    const retry = () => {
      s.unlock?.();
      if (s.current) void s.current.play().catch(() => {});
    };
    const opts = { once: true } as const;
    document.addEventListener('pointerdown', retry, opts);
    document.addEventListener('keydown', retry, opts);
    s.unlock = () => {
      document.removeEventListener('pointerdown', retry);
      document.removeEventListener('keydown', retry);
      s.unlock = null;
    };
  });
}

/** Fetch the track after this one so the crossfade has something to play. */
function prepareNext(s: LobbyMusic): void {
  if (s.next) return;
  refillQueue(s);
  s.next = makeTrack(s.queue[0], 0);
}

function handOver(s: LobbyMusic): void {
  if (s.handingOver) return;
  s.handingOver = true;

  const outgoing = s.current;
  prepareNext(s);
  const incoming = s.next!;
  s.playing = s.queue.shift()!;
  s.current = incoming;
  s.next = null;

  incoming.volume = 0;
  attachTrack(s, incoming);
  startTrack(s, incoming);
  fadeTo(s, incoming, s.volume, () => {
    s.handingOver = false;
  });

  if (outgoing) {
    outgoing.onended = null;
    outgoing.onerror = null;
    fadeTo(s, outgoing, 0, () => {
      outgoing.pause();
      outgoing.src = '';
    });
  } else {
    s.handingOver = false;
  }

  prepareNext(s);
}

function attachTrack(s: LobbyMusic, el: HTMLAudioElement): void {
  // The watchdog normally hands over before `ended`; this is the safety net for
  // a stream whose duration never resolves. A missing or broken file must not
  // end the playlist either — it just moves on to the next one.
  el.onended = () => {
    if (s.current === el) handOver(s);
  };
  el.onerror = () => {
    if (s.current === el) handOver(s);
  };
}

/**
 * Start the lobby playlist: the five `lobby-music-*` tracks in random order,
 * crossfading into each other and reshuffling forever. Calling it again while
 * it's already running is a no-op, so it's safe in an effect.
 */
export function startLobbyMusic(volume = 0.5): void {
  if (typeof window === 'undefined' || lobby) return;

  const s: LobbyMusic = {
    queue: [],
    playing: null,
    current: null,
    next: null,
    volume,
    watchdog: null,
    fades: new Set(),
    handingOver: false,
    unlock: null,
  };
  lobby = s;

  try {
    refillQueue(s);
    s.playing = s.queue.shift()!;
    s.current = makeTrack(s.playing, volume);
    attachTrack(s, s.current);
    startTrack(s, s.current);
    prepareNext(s);

    s.watchdog = setInterval(() => {
      const el = s.current;
      if (!el || s.handingOver || el.paused) return;
      const { duration, currentTime } = el;
      if (!Number.isFinite(duration) || duration <= 0) return;
      if (duration - currentTime <= CROSSFADE_S) handOver(s);
    }, WATCH_MS);
  } catch {
    /* audio must never break the lobby */
    stopLobbyMusic();
  }
}

/** Stop the playlist and release both elements. */
export function stopLobbyMusic(): void {
  const s = lobby;
  if (!s) return;
  lobby = null;

  if (s.watchdog) clearInterval(s.watchdog);
  for (const id of s.fades) clearInterval(id);
  s.fades.clear();
  s.unlock?.();

  for (const el of [s.current, s.next]) {
    if (!el) continue;
    el.onended = null;
    el.onerror = null;
    el.pause();
    el.src = '';
  }
  s.current = null;
  s.next = null;
}
