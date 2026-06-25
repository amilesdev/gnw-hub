import type { ReactNode } from 'react';
import Image from 'next/image';

/** Centered auth screen: cream page, white grain-dusted card, Fraunces title. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="app-shell justify-center px-6">
      <div className="card grain-block animate-enter-home p-7">
        <Image
          src="/wordmark-sage.png"
          alt="Grace Nation Worship"
          width={1242}
          height={448}
          priority
          className="mb-5 h-auto w-[200px] max-w-full"
        />
        <h1 className="page-title mt-2">{title}</h1>
        {subtitle && <p className="mt-2 text-ink-soft">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
