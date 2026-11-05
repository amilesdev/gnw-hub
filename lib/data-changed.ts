import { useEffect, useRef } from 'react';

/**
 * Window event meaning "team data may have changed". Fired after a save through
 * apiFetch, when the service worker finds a newer copy of a read it served from
 * cache, and when the app comes back to the foreground (components/shared/DataSync).
 * Screens that hold their own copy of team data reload on it, so a change shows
 * up without leaving the screen and coming back.
 */
export const DATA_CHANGED_EVENT = 'gnw:data-changed';

/** Writes with their own live paths (chat, Play, calls) or that only touch this device. */
const QUIET_WRITE_PREFIXES = ['/api/chat/', '/api/play/', '/api/calls', '/api/push/'];

export function announceDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}

/** Whether a successful request through apiFetch should announce a change. */
export function isAnnouncedWrite(url: string, method: string | undefined): boolean {
  if (!method || method.toUpperCase() === 'GET') return false;
  const path = new URL(url, window.location.origin).pathname;
  return path.startsWith('/api/') && !QUIET_WRITE_PREFIXES.some((p) => path.startsWith(p));
}

/**
 * Run `onChange` whenever team data may have changed. Saves come in bursts (a
 * drag-reorder, several checkboxes), so it waits for them to settle and runs once.
 */
export function useDataChanged(onChange: () => void) {
  const ref = useRef(onChange);
  ref.current = onChange;
  useEffect(() => {
    let timer = 0;
    const fire = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ref.current(), 250);
    };
    window.addEventListener(DATA_CHANGED_EVENT, fire);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(DATA_CHANGED_EVENT, fire);
    };
  }, []);
}
