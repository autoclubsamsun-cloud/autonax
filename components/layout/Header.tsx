'use client';

import { useEffect, useState } from 'react';

interface HeaderProps {
  user: string;
  onMenuClick: () => void;
  onLogout: () => void;
}

export default function Header({ user, onMenuClick, onLogout }: HeaderProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="header" id="main-header">
      <button className="hd-menu-btn" onClick={onMenuClick} aria-label="Menü">
        <span />
        <span />
        <span />
      </button>

      <div className="hd-logo">
        AUTONAX
        <small>Admin Paneli</small>
      </div>

      <div className="hd-badge">⭐ YÖNETİCİ</div>

      <div className="hd-space" />

      <div className="hd-time">{time}</div>

      <div className="hd-admin">
        <div className="hd-avatar">{user.charAt(0).toUpperCase()}</div>
        <div className="hd-aname">{user}</div>
        <button className="hd-logout" onClick={onLogout}>Çıkış</button>
      </div>
    </header>
  );
}
