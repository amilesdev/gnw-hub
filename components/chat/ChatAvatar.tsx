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
        'grid shrink-0 place-items-center rounded-full font-semibold text-white',
        former && 'opacity-60 grayscale',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: former ? 'rgb(var(--ink-faint))' : 'linear-gradient(150deg, #5E7048, #3c4a2c)',
      }}
    >
      {name.trim().slice(0, 1).toUpperCase() || '?'}
    </Avatar>
  );
}
