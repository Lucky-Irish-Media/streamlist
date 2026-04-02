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

let withNextOnPages = (config) => config

try {
  const nextOnPages = await import('@cloudflare/next-on-pages')
  withNextOnPages = nextOnPages.default
} catch (e) {
  console.warn('@cloudflare/next-on-pages not available')
}

const withPages = withNextOnPages(nextConfig)

export default withPages
