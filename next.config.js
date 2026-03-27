let withNextOnPages

try {
  withNextOnPages = (await import('@cloudflare/next-on-pages')).default
} catch (e) {
  withNextOnPages = (config) => config
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
      },
    ],
  },
}

const withPages = withNextOnPages(nextConfig)

export default withPages