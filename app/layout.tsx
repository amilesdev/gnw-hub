import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ServiceWorkerRegistrar } from '@/components/shared/ServiceWorkerRegistrar';
import { DebugViewport } from '@/components/shared/DebugViewport';

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
  title: 'GNW Worship Hub',
  description: 'Communication hub for the GNW praise & worship team.',
  applicationName: 'GNW Worship Hub',
  manifest: '/manifest.webmanifest',
  // black-translucent lets the app background + grain fill behind the status bar
  // (true edge-to-edge); content stays clear of it via safe-area padding.
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
  // Required for env(safe-area-inset-*) to return real values on notched iPhones
  // in standalone (installed) mode — without it content slams under the notch.
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
        <DebugViewport />
      </body>
    </html>
  );
}
