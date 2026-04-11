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
        source: '/panel',
        destination: '/standalone/panel.html',
      },
      {
        source: '/hesabim',
        destination: '/standalone/hesabim.html',
      },
    ];
  },
};

module.exports = nextConfig;
