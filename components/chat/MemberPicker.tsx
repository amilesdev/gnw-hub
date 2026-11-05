'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChatPersonDTO } from '@/lib/chat/types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Check } from '@/components/shared/Icons';
import { ChatAvatar } from './ChatAvatar';

/** Loads everyone who can be put in a chat (GET /api/chat/people) once mounted. */
export function useChatPeople(): { people: ChatPersonDTO[] | null; error: string | null } {
  const [people, setPeople] = useState<ChatPersonDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ people: ChatPersonDTO[] }>('/api/chat/people')
      .then((r) => !cancelled && setPeople(r.people))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load people.'));
    return () => {
      cancelled = true;
    };
  }, []);
  return { people, error };
}

/** Searchable multi-select of Hub people. `exclude` hides people (e.g. already in the chat). */
export function MemberPicker({
  people,
  selected,
  onToggle,
  exclude,
}: {
  people: ChatPersonDTO[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  exclude?: Set<string>;
}) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => !exclude?.has(p.id) && (!q || p.name.toLowerCase().includes(q)));
  }, [people, exclude, query]);

  return (
    <div className="space-y-3">
      <input
        className="field"
        type="search"
        placeholder="Search people"
        aria-label="Search people"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {visible.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-faint">{query ? 'No one by that name.' : 'Everyone’s already here.'}</p>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((p) => {
            const on = selected.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onToggle(p.id)}
                  aria-pressed={on}
                  className="row-press flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left"
                >
                  <ChatAvatar name={p.name} image={p.image} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    {p.status === 'pending' && <span className="text-xs text-ink-faint">Invited — hasn’t joined Hub yet</span>}
                  </span>
                  <span
                    className={cn(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2',
                      on ? 'border-accent bg-accent text-white' : 'border-line',
                    )}
                    aria-hidden
                  >
                    {on && <Check width={14} height={14} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
