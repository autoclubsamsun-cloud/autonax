/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // /standalone/ URL'lerine direkt erişimi engelle — temiz URL'ye yönlendir
      {
        source: '/standalone/desktop.html',
        destination: '/',
        permanent: false,
      },
      {
        source: '/standalone/pnl_atn.html',
        destination: '/pnl_atn',
        permanent: false,
      },
      {
        source: '/standalone/hesabim.html',
        destination: '/hesabim',
        permanent: false,
      },
      {
        source: '/standalone/panel.html',
        destination: '/pnl_atn',
        permanent: true,
      },
    ];
  },
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
