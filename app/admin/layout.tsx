'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated, logout, getCurrentUser } from '@/lib/utils/auth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Toast from '@/components/ui/Toast';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    setUser(getCurrentUser() || 'Admin');
    setReady(true);
  }, [router]);

  function handleLogout() {
    if (confirm('Çıkış yapmak istiyor musunuz?')) {
      logout();
      router.push('/login');
    }
  }

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 24, letterSpacing: 4, color: '#B01C2E' }}>AUTONAX</div>
      </div>
    );
  }

  return (
    <>
      <Header
        user={user}
        onMenuClick={() => setSidebarOpen(o => !o)}
        onLogout={handleLogout}
      />
      <div className="layout">
        {/* Sidebar overlay for mobile */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />
        <Sidebar
          open={sidebarOpen}
          currentPath={pathname}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="main">
          {children}
        </main>
      </div>
      <Toast />
    </>
  );
}
