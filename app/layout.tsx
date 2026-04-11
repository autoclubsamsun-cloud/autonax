import type { Metadata } from 'next';
import '@/styles/globals.css';

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
