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
    ];
  },
};

module.exports = nextConfig;
