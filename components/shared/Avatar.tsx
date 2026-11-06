import { cn } from '@/lib/utils';

/**
 * Low-level avatar: when `image` is set (a profile picture URL) it fills the
 * wrapper with the photo; otherwise it falls back to `children`. The wrapper
 * keeps the caller's own `className`, and `rounded-[inherit]` makes the image
 * adopt its corner radius. Prefer {@link MemberAvatar} for people.
 */
export function Avatar({
  image,
  className,
  imgClassName,
  alt = '',
  style,
  children,
}: {
  image?: string | null;
  className?: string;
  imgClassName?: string;
  alt?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <span className={cn('relative overflow-hidden', className)} style={style}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage
        // URLs are remote + user-supplied; next/image config isn't set up here.
        <img
          src={image}
          alt={alt}
          className={cn('absolute inset-0 h-full w-full rounded-[inherit] object-cover', imgClassName)}
        />
      ) : (
        children
      )}
    </span>
  );
}

function initials(name: string, letters: 1 | 2) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] ?? '';
  const last = letters === 2 && parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * The one avatar style (CMP-13): always a circle. A photo fills it; otherwise
 * a Literata initial at 42% of the size.
 * - `flat` (default): accent-soft fill, accent-ink initial.
 * - `drop`: the glass droplet (the floating avatar).
 * - `accent`: accent fill with two letters (call tiles).
 */
export function MemberAvatar({
  name,
  image,
  size,
  variant = 'flat',
  className,
  title,
}: {
  name: string;
  image?: string | null;
  size: number;
  variant?: 'flat' | 'drop' | 'accent';
  className?: string;
  title?: string;
}) {
  return (
    <Avatar
      image={image}
      alt={name}
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-display font-semibold leading-none',
        variant === 'flat' && 'bg-accent-soft text-accent-ink',
        variant === 'drop' && 'glass-drop text-accent-ink',
        variant === 'accent' && 'bg-accent text-accent-fg',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      <span title={title} aria-hidden={!!image || undefined}>
        {initials(name, variant === 'accent' ? 2 : 1)}
      </span>
    </Avatar>
  );
}

/** Overlapping faces (song leads in rows): max 3, then a "+n" bubble. */
export function FaceStack({
  people,
  size = 28,
  max = 3,
  className,
}: {
  people: { id: string; name: string; image?: string | null }[];
  size?: number;
  max?: number;
  className?: string;
}) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className={cn('flex items-center', className)} aria-label={people.map((p) => p.name).join(', ')}>
      {shown.map((p, i) => (
        <MemberAvatar
          key={p.id}
          name={p.name}
          image={p.image}
          size={size}
          className={cn('ring-2 ring-surface', i > 0 && '-ml-2')}
        />
      ))}
      {extra > 0 && (
        <span
          className="-ml-2 grid shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-bold text-ink-soft ring-2 ring-surface"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
