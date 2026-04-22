/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pas besoin de i18n pour une seule langue
  experimental: {
    // This app uses proxy.ts, so multipart uploads are buffered before the route handler.
    // Raise the cap above the 50MB server-side video limit so uploads reach /api/media/upload intact.
    proxyClientMaxBodySize: '60mb',
  },
}

module.exports = nextConfig
