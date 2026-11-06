'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SongDTO } from '@/lib/setlist-serialize';
import type { SongSheetContext } from './AudioProvider';
import { SongDetail } from './SongDetail';

type Open = { song: SongDTO; context?: SongSheetContext } | null;

const SheetCtx = createContext<{ open: (song: SongDTO, context?: SongSheetContext) => void } | null>(null);

/**
 * Lets the MiniPlayer reopen the song that's playing (SG-C3), from any screen,
 * even after the sheet that started it has closed. Screens still open their
 * own sheets as before; this is only the "tap the player" path.
 */
export function SongSheetProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Open>(null);
  const open = useCallback((song: SongDTO, context?: SongSheetContext) => setCurrent({ song, context }), []);
  const api = useMemo(() => ({ open }), [open]);
  return (
    <SheetCtx.Provider value={api}>
      {children}
      {current && <SongDetail song={current.song} context={current.context} onClose={() => setCurrent(null)} />}
    </SheetCtx.Provider>
  );
}

export function useSongSheet() {
  return useContext(SheetCtx);
}
