/** @type {import('next').NextConfig} */
const nextConfig = {
  // Images externes autorisées
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
      },
    ],
  },

  // Headers de sécurité
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      // Permettre l'iframe pour les portails immobiliers
      {
        source: '/embed/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
        ],
      },
    ]
  },

  // Redirections
  async redirects() {
    return [
      {
        source: '/tour/:id',
        destination: '/tours/:id',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
