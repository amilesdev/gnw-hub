import type { ComponentType } from 'react';

type IconProps = { width?: number; height?: number; className?: string };

/**
 * Placeholder screen for a tab that holds its place in the nav before the
 * feature behind it exists (Chat, Crossover).
 */
export function ComingSoon({
  title,
  icon: Icon,
  headline,
  body,
}: {
  title: string;
  icon: ComponentType<IconProps>;
  headline: string;
  body: string;
}) {
  return (
    <div className="space-y-5 pt-2">
      <header className="pr-12">
        <div className="eyebrow">GNW Hub</div>
        <h1 className="page-title mt-2">{title}</h1>
      </header>

      <div className="card grain-block flex flex-col items-center px-6 py-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent dark:text-accent-on">
          <Icon width={28} height={28} className="animate-breathe" />
        </div>
        <span className="chip mt-5 bg-accent/10 text-accent-ink dark:text-accent-on">Coming soon</span>
        <p className="mt-3 font-semibold text-ink">{headline}</p>
        <p className="mt-1.5 text-sm text-ink-soft">{body}</p>
      </div>
    </div>
  );
}
