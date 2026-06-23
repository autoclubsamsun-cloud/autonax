import type { Metadata } from 'next';
import '@/styles/globals.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Autonax Admin Panel',
  description: 'Autonax Premium Araç Koruma — Yönetim Paneli',
  icons: { icon: '/icons/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
