import type { ReactNode } from 'react';
import Image from 'next/image';

/**
 * Signed-out screens (AU-1…5): the ambient glow behind a solid card with the
 * wordmark, a Literata title and the form. No avatar, no tab bar.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  logoSize = 'default',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** `lg` enlarges the wordmark (used on the primary sign-in screen). */
  logoSize?: 'default' | 'lg';
}) {
  return (
    <div className="app-shell">
      <div className="app-glow" aria-hidden />
      <div className="app-wash" aria-hidden />
      <div
        className="no-scrollbar relative flex-1 overflow-y-auto px-5 pb-10"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}
      >
        <div className="card grain-block animate-enter-home space-y-6 p-7">
          {/* Sage wordmark for light, cream for dark — swapped purely in CSS so it
              tracks the theme with no client JS. */}
          <div className="relative">
            <Image
              src="/wordmark-sage.png"
              alt="Grace Nation Worship"
              width={1242}
              height={448}
              priority
              className={`h-auto dark:hidden ${
                logoSize === 'lg'
                  ? 'relative left-1/2 w-[88vw] max-w-[460px] -translate-x-1/2'
                  : 'mx-auto w-[200px] max-w-full'
              }`}
            />
            <Image
              src="/wordmark-cream.png"
              alt="Grace Nation Worship"
              width={1242}
              height={448}
              priority
              className={`hidden h-auto dark:block ${
                logoSize === 'lg'
                  ? 'relative left-1/2 w-[88vw] max-w-[460px] -translate-x-1/2'
                  : 'mx-auto w-[200px] max-w-full'
              }`}
            />
          </div>
          <div className="relative">
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="mt-2 text-base leading-6 text-ink-soft">{subtitle}</p>}
          </div>
          <div className="relative">{children}</div>
        </div>
      </div>
    </div>
  );
}
