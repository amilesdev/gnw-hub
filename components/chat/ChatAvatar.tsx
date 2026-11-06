import { Avatar } from '@/components/shared/Avatar';
import { cn } from '@/lib/utils';

/**
 * A person's face (or initial) in chat. `former` = not a Hub member (imported
 * GroupMe author, or removed) — grayed so it reads as a past participant.
 */
export function ChatAvatar({
  name,
  image,
  size = 32,
  former = false,
  className,
}: {
  name: string;
  image: string | null;
  size?: number;
  former?: boolean;
  className?: string;
}) {
  return (
    <Avatar
      image={image}
      alt=""
      className={cn(
        // The one avatar style (CMP-13); a former member is greyed out.
        'grid shrink-0 place-items-center rounded-full font-display font-semibold leading-none',
        former ? 'bg-surface-2 text-ink-faint opacity-70 grayscale' : 'bg-accent-soft text-accent-ink',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {name.trim().slice(0, 1).toUpperCase() || '?'}
    </Avatar>
  );
}
