'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { SetlistDTO } from '@/lib/setlist-serialize';
import { ScreenHeader } from './ScreenHeader';
import { SegmentedControl } from './SegmentedControl';
import { SetlistScreen } from './SetlistScreen';
import { SongLibraryBrowser } from './SongLibraryBrowser';
import { SetlistManager } from '@/components/leader/SetlistManager';
import { SongLibrary } from '@/components/leader/SongLibrary';
import { MusicPlus, Plus } from './Icons';

type View = 'setlists' | 'library';

/**
 * The Songs tab (SG-1/2/4/5): one header ("Songs") and a glass Setlists |
 * Library switch over two peer views. The view lives in `?view=library` so
 * back, refresh and push links land on the right one; switching replaces the
 * URL rather than adding history. Both views stay mounted once visited, so
 * switching back is instant and the library search survives the trip.
 */
export function SongsTab({ role, initialSetlists }: { role: 'member' | 'leader'; initialSetlists?: SetlistDTO[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const leader = role === 'leader';
  const base = leader ? '/dashboard' : '/home';
  const [view, setView] = useState<View>(params.get('view') === 'library' ? 'library' : 'setlists');
  const [seenLibrary, setSeenLibrary] = useState(view === 'library');
  const [q, setQ] = useState('');
  const [newSetlist, setNewSetlist] = useState(false);
  const [newSong, setNewSong] = useState(false);

  function switchTo(next: View) {
    setView(next);
    if (next === 'library') setSeenLibrary(true);
    // Next keeps useSearchParams in sync with history.replaceState, without a
    // server round trip for what is only a client-side view switch.
    window.history.replaceState(null, '', next === 'library' ? `${pathname}?view=library` : pathname);
  }

  const actions =
    view === 'setlists' ? (
      leader && (
        <button type="button" className="btn-primary btn-sm h-11" onClick={() => setNewSetlist(true)}>
          <Plus width={16} height={16} /> Add
        </button>
      )
    ) : (
      <>
        {/* Icon-only below 390pt so the header fits beside the floating avatar. */}
        <Link
          href={`${base}/library/suggestions`}
          className="btn-outline btn-sm h-11 max-[389px]:w-11 max-[389px]:px-0"
          aria-label="Suggest a song"
        >
          <MusicPlus width={16} height={16} />
          <span className="max-[389px]:hidden">Suggest</span>
        </Link>
        {leader && (
          <button type="button" className="btn-primary btn-sm h-11" onClick={() => setNewSong(true)}>
            <Plus width={16} height={16} /> New
          </button>
        )}
      </>
    );

  return (
    <div>
      <ScreenHeader eyebrow={leader ? 'Leader tools' : 'GNW Hub'} title="Songs" actions={actions || undefined} />
      <SegmentedControl
        variant="glass"
        role="tablist"
        aria-label="Songs view"
        className="mb-6"
        options={[
          { value: 'setlists', label: 'Setlists' },
          { value: 'library', label: 'Library' },
        ]}
        value={view}
        onChange={switchTo}
      />

      <div hidden={view !== 'setlists'}>
        {leader ? (
          <SetlistManager creating={newSetlist} onCreatingChange={setNewSetlist} />
        ) : (
          <SetlistScreen initialSetlists={initialSetlists} />
        )}
      </div>
      {seenLibrary && (
        <div hidden={view !== 'library'}>
          {leader ? (
            <SongLibrary inTab q={q} onQChange={setQ} creating={newSong} onCreatingChange={setNewSong} />
          ) : (
            <SongLibraryBrowser q={q} onQChange={setQ} />
          )}
        </div>
      )}
    </div>
  );
}
