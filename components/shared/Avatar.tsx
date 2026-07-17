import { cn } from '@/lib/utils';

/**
 * Renders a member's avatar. When `image` is set (a profile picture URL) it
 * fills the tile with the photo; otherwise it falls back to `children` — the
 * caller's existing initial(s). The wrapper keeps the caller's own `className`
 * (size, corner radius, gradient, font), so each surface preserves its exact
 * look and the photo simply covers the gradient. `rounded-[inherit]` makes the
 * image adopt whatever corner radius the wrapper defines.
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
