import type { LeadDTO } from '@/lib/setlist-serialize';
import { FaceStack, MemberAvatar } from './Avatar';

/**
 * Who's leading a song, in the two shapes the app needs:
 *
 * - `SongLeadFaces` — just the faces (CMP-13: 28px circles, max 3, then +N),
 *   sitting at the right edge of a setlist row. Deliberately no names: the
 *   row's own two lines stay as they were, and the names are still announced
 *   to screen readers and spelled out on the song sheet. Span-only, since
 *   every song row is a <button>.
 * - `SongLeadBlock` — the labelled block on the song sheet.
 *
 * Both render nothing when nobody is set, so a setlist without leads looks
 * exactly as it did before the feature existed.
 */
export function SongLeadFaces({ leads }: { leads: LeadDTO[] }) {
  if (leads.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center">
      <span aria-hidden>
        <FaceStack people={leads} />
      </span>
      <span className="sr-only">Led by {leads.map((l) => l.name).join(', ')}</span>
    </span>
  );
}

export function SongLeadBlock({ leads }: { leads: LeadDTO[] }) {
  if (leads.length === 0) return null;
  return (
    <div>
      <p className="label mb-2">{leads.length > 1 ? 'Song leads' : 'Song lead'}</p>
      <div className="flex flex-wrap gap-2">
        {leads.map((l) => (
          <span
            key={l.id}
            className="inline-flex h-8 items-center gap-2 rounded-full bg-accent-soft pl-1 pr-3.5 text-sm font-semibold text-accent-ink"
          >
            <MemberAvatar name={l.name} image={l.image} size={24} />
            {l.name}
          </span>
        ))}
      </div>
    </div>
  );
}
