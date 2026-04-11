/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/standalone/desktop.html',
        permanent: false,
      },
      {
        source: '/panel',
        destination: '/admin/dashboard',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/standalone/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
};

module.exports = nextConfig;
