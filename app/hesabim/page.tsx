'use client';

import { useEffect } from 'react';

/**
 * Müşteri Paneli — Hesabım
 * Şu an standalone HTML. Production'da Next.js sayfasıyla değiştir.
 */
export default function HesabimPage() {
  useEffect(() => {
    window.location.replace('/standalone/hesabim.html');
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#B01C2E', fontFamily: 'sans-serif', fontSize: 18 }}>
      Yükleniyor...
    </div>
  );
}
