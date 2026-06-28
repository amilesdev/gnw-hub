import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ServiceWorkerRegistrar } from '@/components/shared/ServiceWorkerRegistrar';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: 'GNW Hub',
  description: 'Communication hub for the GNW team.',
  applicationName: 'GNW Hub',
  manifest: '/manifest.webmanifest',
  // `black-translucent` lets the web view extend *under* the status bar so the app
  // background/grain fills edge-to-edge (no flat status-bar strip). Requires
  // `viewportFit: 'cover'` below; content is then inset via env(safe-area-inset-top).
  // NOTE: on the light theme the status-bar clock/icons render light — readable in
  // dark mode, faint on the cream bg in light mode (inherent black-translucent cost).
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'GNW Hub' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Render edge-to-edge under the status bar / home indicator. Pairs with the
  // `black-translucent` status bar; the shell + safe-area insets handle spacing.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF7F2' },
    { media: '(prefers-color-scheme: dark)', color: '#161410' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
