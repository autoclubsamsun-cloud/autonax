/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // public/ klasöründeki statik dosyalar otomatik servis edilir
  // Hiçbir ek ayar gerekmez — Next.js public/ klasörünü kök URL'de sunar
  async redirects() {
    return [
      {
        source: '/',
        destination: '/standalone/desktop.html',
        permanent: false,
      },
      {
        source: '/panel',
        destination: '/standalone/panel.html',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
