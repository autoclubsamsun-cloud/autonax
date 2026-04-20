/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/standalone/desktop.html',
      },
      {
        source: '/pnl_atn',
        destination: '/standalone/pnl_atn.html',
      },
      {
        source: '/hesabim',
        destination: '/standalone/hesabim.html',
      },
      {
        source: '/odeme/:kod',
        destination: '/standalone/odeme.html',
      },
      {
        source: '/odeme-basarili',
        destination: '/standalone/odeme-basarili.html',
      },
      {
        source: '/odeme-basarisiz',
        destination: '/standalone/odeme-basarisiz.html',
      },
    ];
  },
};
module.exports = nextConfig;
