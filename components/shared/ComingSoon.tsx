import type { ComponentType } from 'react';
import { ScreenHeader } from './ScreenHeader';
import { EmptyState } from './EmptyState';

type IconProps = { width?: number; height?: number; className?: string };

/**
 * Placeholder screen for a tab that holds its place in the nav before the
 * feature behind it is open to everyone (CH-1a, CR-1): the shared header and a
 * "Coming soon" empty state, so the real feature replaces only the body.
 */
export function ComingSoon({
  title,
  icon,
  headline,
  body,
}: {
  title: string;
  icon: ComponentType<IconProps>;
  headline: string;
  body: string;
}) {
  return (
    <div>
      <ScreenHeader eyebrow="GNW Hub" title={title} />
      <EmptyState icon={icon} chip="Coming soon" message={headline} body={body} />
    </div>
  );
}
