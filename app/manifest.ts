import type { MetadataRoute } from 'next';

// Web App Manifest (served at /manifest.webmanifest). Makes the app installable
// to the Home Screen with a real icon, standalone window, and brand colors.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GNW Worship Hub',
    short_name: 'GNW Hub',
    description: 'Communication hub for the GNW praise & worship team.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAF7F2',
    theme_color: '#FAF7F2',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
