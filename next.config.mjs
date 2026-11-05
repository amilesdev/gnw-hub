/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev only: let a phone on the same Wi-Fi load the dev server by the Mac's
  // LAN IP (Next blocks cross-origin dev assets otherwise). Set DEV_LAN_HOST to
  // the IP and start dev with NEXTAUTH_URL=http://<ip>:3000 so sign-in returns there.
  allowedDevOrigins: process.env.DEV_LAN_HOST ? [process.env.DEV_LAN_HOST] : [],
  images: {
    remotePatterns: [
      // Supabase Storage public URLs (attire photos, etc.)
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Camera/mic stay available to the app itself (LiveKit calls), but
          // no embedded third-party frame can request them.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
