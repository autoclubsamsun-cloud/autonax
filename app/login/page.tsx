'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { validateCredentials, login } from '@/lib/utils/auth';

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    await new Promise(r => setTimeout(r, 400));
    if (validateCredentials(user, pass)) {
      login(user);
      router.push('/admin/dashboard');
    } else {
      setErr('Kullanıcı adı veya şifre hatalı!');
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-glow" />
      <div className="login-bg-glow2" />

      <div className="login-card">
        <div className="login-logo">AUTONAX</div>
        <div className="login-sub">ADMİN PANELİ</div>

        <div className="login-tag">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          YETKİLİ ERİŞİMİ
        </div>

        {err && <div className="login-err">{err}</div>}

        <form onSubmit={handleLogin}>
          <div className="lf">
            <label>Kullanıcı Adı</label>
            <input
              type="text"
              placeholder="admin"
              value={user}
              onChange={e => setUser(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="lf">
            <label>Şifre</label>
            <input
              type="password"
              placeholder="••••••••"
              value={pass}
              onChange={e => setPass(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'GİRİŞ YAPILIYOR...' : 'GİRİŞ YAP'}
          </button>
        </form>

        <div className="login-hint">
          Demo: <b>admin</b> / <b>admin123</b>
        </div>
      </div>
    </div>
  );
}
