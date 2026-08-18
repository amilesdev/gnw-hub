import type { LeadDTO } from '@/lib/setlist-serialize';
import { Avatar } from './Avatar';
import { cn } from '@/lib/utils';

/**
 * Who's leading a song, in the two shapes the app needs:
 *
 * - `SongLeadFaces` — just the faces, sitting at the right edge of a setlist
 *   row. Deliberately no names: the row's own two lines (title + artist/parts)
 *   stay as they were, and the names are still announced to screen readers and
 *   spelled out on the song sheet. Span-only, since every song row is a
 *   <button>.
 * - `SongLeadBlock` — the labelled block on the song sheet.
 *
 * Both render nothing when nobody is set, so a setlist without leads looks
 * exactly as it did before the feature existed.
 */

function LeadFace({ lead, className }: { lead: LeadDTO; className: string }) {
  return (
    <Avatar
      image={lead.image}
      alt=""
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-ink font-bold text-white',
        className,
      )}
    >
      {lead.name.charAt(0).toUpperCase()}
    </Avatar>
  );
}

/** Faces shown before the rest roll up into a +N bubble, so a song with a big
 *  group of co-leads can't crowd the song title out of its row. */
const MAX_FACES = 3;

export function SongLeadFaces({ leads }: { leads: LeadDTO[] }) {
  if (leads.length === 0) return null;
  const shown = leads.slice(0, MAX_FACES);
  const overflow = leads.length - shown.length;
  return (
    <span className="flex shrink-0 -space-x-2">
      {/* ring-surface separates overlapping faces against the row's card background. */}
      {shown.map((l) => (
        <LeadFace key={l.id} lead={l} className="h-7 w-7 text-[11px] ring-2 ring-surface" />
      ))}
      {overflow > 0 && (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-bold text-ink-soft ring-2 ring-surface">
          +{overflow}
        </span>
      )}
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
            className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent/10 py-1 pl-1 pr-3.5 text-sm font-semibold"
          >
            <LeadFace lead={l} className="h-7 w-7 text-xs" />
            {l.name}
          </span>
        ))}
      </div>
    </div>
  );
}
