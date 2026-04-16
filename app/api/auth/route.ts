import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import crypto from 'crypto';

// ── Token Ayarları ─────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'autonax-fallback-secret-degistir';
const TOKEN_COOKIE = 'autonax_token';
const TOKEN_EXPIRY_HOURS = 8;

interface TokenPayload {
  sub: string;   // username
  iat: number;   // issued at (epoch saniye)
  exp: number;   // expires at (epoch saniye)
}

/** Basit JWT token oluştur (ek paket gerekmez) */
function createToken(username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: username,
    iat: now,
    exp: now + TOKEN_EXPIRY_HOURS * 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

/** Token doğrula — geçerliyse payload döner, değilse null */
function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expected = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (signature !== expected) return null;
    const payload: TokenPayload = JSON.parse(
      Buffer.from(body, 'base64url').toString()
    );
    if (Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** httpOnly cookie set */
function setTokenCookie(res: NextResponse, token: string): void {
  res.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: TOKEN_EXPIRY_HOURS * 3600,
  });
}

/** Cookie temizle */
function clearTokenCookie(res: NextResponse): void {
  res.cookies.set(TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

// ── DB ─────────────────────────────────────────────────────────────
let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

async function getCredentials() {
  const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar='admin_credentials'`;
  if (rows.length > 0) {
    const c = rows[0].deger as any;
    return { username: c.username || 'admin', password: c.password || 'admin123' };
  }
  return { username: 'admin', password: 'admin123' };
}

// ── POST Endpoint ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await ensureDB();
    const { username, password, action } = await req.json();

    // ── LOGIN: şifreyi doğrula → JWT cookie set ────────────────────
    if (action === 'login') {
      const creds = await getCredentials();
      if (username === creds.username && password === creds.password) {
        const token = createToken(username);
        const res = NextResponse.json({ success: true, username: creds.username });
        setTokenCookie(res, token);
        return res;
      }
      return NextResponse.json(
        { success: false, error: 'Hatalı giriş' },
        { status: 401 }
      );
    }

    // ── LOGOUT: cookie temizle ─────────────────────────────────────
    if (action === 'logout') {
      const res = NextResponse.json({ success: true });
      clearTokenCookie(res);
      return res;
    }

    // ── SESSION CHECK: cookie'deki token'ı doğrula ─────────────────
    if (action === 'check_session') {
      const token = req.cookies.get(TOKEN_COOKIE)?.value;
      if (!token) {
        return NextResponse.json({ success: false, authenticated: false });
      }
      const payload = verifyToken(token);
      if (!payload) {
        const res = NextResponse.json({ success: false, authenticated: false });
        clearTokenCookie(res);
        return res;
      }
      return NextResponse.json({
        success: true,
        authenticated: true,
        username: payload.sub,
      });
    }

    // ── UPDATE CREDENTIALS (auth gerekli) ──────────────────────────
    if (action === 'update') {
      const token = req.cookies.get(TOKEN_COOKIE)?.value;
      if (!token || !verifyToken(token)) {
        return NextResponse.json(
          { success: false, error: 'Yetkisiz' },
          { status: 401 }
        );
      }
      await sql`INSERT INTO site_ayarlar (anahtar,deger)
        VALUES ('admin_credentials',${JSON.stringify({ username, password })}::jsonb)
        ON CONFLICT (anahtar) DO UPDATE
        SET deger=${JSON.stringify({ username, password })}::jsonb, guncelleme=NOW()`;
      return NextResponse.json({ success: true });
    }

    // ── get_credentials KALDIRILDI ─────────────────────────────────
    if (action === 'get_credentials') {
      return NextResponse.json(
        { success: false, error: 'Bu endpoint güvenlik nedeniyle kaldırıldı' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Geçersiz işlem' },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}

// ── GET: Diğer API route'ları token doğrulaması için kullanabilir ──
export async function GET(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, username: payload.sub });
}
