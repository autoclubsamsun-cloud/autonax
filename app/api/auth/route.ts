import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import crypto from 'crypto';

// ── Token Ayarları ─────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'autonax-fallback-secret-degistir';
const TOKEN_COOKIE = 'autonax_token';
const TOKEN_EXPIRY_HOURS = 8;

interface TokenPayload {
  sub: string;         // username
  rol: string;         // 'super_admin' | 'admin' | 'muhasebe' | 'teknisyen' | 'resepsiyonist' | 'saha'
  kaynak: string;      // 'admin' | 'personel'
  iat: number;         // issued at (epoch saniye)
  exp: number;         // expires at (epoch saniye)
}

/** Basit JWT token oluştur (ek paket gerekmez) */
function createToken(username: string, rol: string, kaynak: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: username,
    rol,
    kaynak,
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

// ── Brute Force Koruması ─────────────────────────────────────────────
// Aynı IP'den dakikada 5'ten fazla başarısız login → 15 dk kilit
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MIN = 1;       // dakika içindeki denemeleri say
const RATE_LIMIT_LOCKOUT_MIN = 15;     // limit aşılırsa kaç dakika kilitli

let rateTableReady = false;
async function ensureRateTable() {
  if (rateTableReady) return;
  await sql`CREATE TABLE IF NOT EXISTS auth_rate_limit (
    ip TEXT PRIMARY KEY,
    fail_count INTEGER NOT NULL DEFAULT 0,
    first_fail_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ
  )`;
  rateTableReady = true;
}

/** İstemci IP'sini header'lardan çek (Vercel x-forwarded-for kullanır) */
function getClientIP(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}

/**
 * Login denemeden önce IP kilitli mi kontrol et.
 * Kilitliyse → { blocked: true, retryAfterSec }
 * Değilse → { blocked: false }
 */
async function checkRateLimit(ip: string): Promise<{ blocked: boolean; retryAfterSec?: number }> {
  try {
    await ensureRateTable();
    const rows = await sql`
      SELECT fail_count, first_fail_at, locked_until
      FROM auth_rate_limit
      WHERE ip = ${ip}
      LIMIT 1
    `;
    if (rows.length === 0) return { blocked: false };
    const r = rows[0] as { fail_count: number; first_fail_at: string; locked_until: string | null };
    if (r.locked_until) {
      const until = new Date(r.locked_until).getTime();
      const now = Date.now();
      if (until > now) {
        return { blocked: true, retryAfterSec: Math.ceil((until - now) / 1000) };
      }
      // Kilit süresi geçmiş → temizle
      await sql`DELETE FROM auth_rate_limit WHERE ip = ${ip}`;
    }
    return { blocked: false };
  } catch (e) {
    console.error('[AUTH] Rate limit kontrol hatası:', e);
    // Hata olursa engelleme — sistem çalışmaya devam etsin
    return { blocked: false };
  }
}

/** Başarısız login sonrası sayacı artır, gerekirse kilitle */
async function recordFailedAttempt(ip: string): Promise<void> {
  try {
    await ensureRateTable();
    const rows = await sql`
      SELECT fail_count, first_fail_at FROM auth_rate_limit WHERE ip = ${ip} LIMIT 1
    `;
    if (rows.length === 0) {
      await sql`INSERT INTO auth_rate_limit (ip, fail_count, first_fail_at)
        VALUES (${ip}, 1, NOW())`;
      return;
    }
    const r = rows[0] as { fail_count: number; first_fail_at: string };
    const windowStart = new Date(r.first_fail_at).getTime();
    const elapsedMin = (Date.now() - windowStart) / 60000;
    if (elapsedMin > RATE_LIMIT_WINDOW_MIN) {
      // Pencere geçmiş → sayacı sıfırla
      await sql`UPDATE auth_rate_limit SET fail_count = 1, first_fail_at = NOW(), locked_until = NULL WHERE ip = ${ip}`;
      return;
    }
    const newCount = r.fail_count + 1;
    if (newCount >= RATE_LIMIT_MAX_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + RATE_LIMIT_LOCKOUT_MIN * 60000);
      await sql`UPDATE auth_rate_limit SET fail_count = ${newCount}, locked_until = ${lockUntil.toISOString()} WHERE ip = ${ip}`;
    } else {
      await sql`UPDATE auth_rate_limit SET fail_count = ${newCount} WHERE ip = ${ip}`;
    }
  } catch (e) {
    console.error('[AUTH] Failed attempt kayıt hatası:', e);
  }
}

/** Başarılı login sonrası kayıt sıfırla */
async function clearFailedAttempts(ip: string): Promise<void> {
  try {
    await ensureRateTable();
    await sql`DELETE FROM auth_rate_limit WHERE ip = ${ip}`;
  } catch (e) {
    console.error('[AUTH] Clear attempts hatası:', e);
  }
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
      // 0) IP rate limit kontrolü — 5 yanlış denemeden sonra 15 dk kilit
      const clientIP = getClientIP(req);
      const rateCheck = await checkRateLimit(clientIP);
      if (rateCheck.blocked) {
        const dakika = Math.ceil((rateCheck.retryAfterSec || 0) / 60);
        return NextResponse.json(
          { success: false, error: `Çok fazla başarısız deneme. ${dakika} dakika sonra tekrar deneyin.` },
          { status: 429 }
        );
      }

      // 1) Önce admin credentials kontrolü
      const creds = await getCredentials();
      if (username === creds.username && password === creds.password) {
        await clearFailedAttempts(clientIP);
        const token = createToken(username, 'super_admin', 'admin');
        const res = NextResponse.json({
          success: true,
          username: creds.username,
          rol: 'super_admin',
          kaynak: 'admin',
          adSoyad: 'Yönetici',
          yetkiler: {
            randevu: true, odeme: true, fatura: true, fiyat: true,
            rapor: true, bayi: true, ayarlar: true, personel: true
          }
        });
        setTokenCookie(res, token);
        return res;
      }

      // 2) Personel tablosunda ara
      try {
        // personel tablosu yoksa hata vermesin
        await sql`CREATE TABLE IF NOT EXISTS personel (
          id TEXT PRIMARY KEY,
          ad TEXT NOT NULL,
          email TEXT,
          tel TEXT,
          sifre TEXT,
          rol TEXT NOT NULL DEFAULT 'teknisyen',
          aktif BOOLEAN DEFAULT TRUE,
          yetkiler JSONB DEFAULT '{}'::jsonb,
          kullanici_adi TEXT,
          kayit_tarihi TIMESTAMPTZ DEFAULT NOW()
        )`;
        // Var olan tablo icin eksik kolonlari ekle (migrate)
        await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS email TEXT`;
        await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS tel TEXT`;
        await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS sifre TEXT`;
        await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'teknisyen'`;
        await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS aktif BOOLEAN DEFAULT TRUE`;
        await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS yetkiler JSONB DEFAULT '{}'::jsonb`;
        await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS kullanici_adi TEXT`;
        await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS kayit_tarihi TIMESTAMPTZ DEFAULT NOW()`;

        // Username olarak 'kullanici_adi' (yoksa 'email' veya 'ad') kabul ediyoruz
        const personelRows = await sql`
          SELECT id, ad, email, rol, aktif, yetkiler, sifre, kullanici_adi
          FROM personel
          WHERE aktif = TRUE
            AND (
              LOWER(kullanici_adi) = LOWER(${username})
              OR LOWER(email) = LOWER(${username})
            )
            AND sifre = ${password}
          LIMIT 1
        `;

        if (personelRows.length > 0) {
          const p = personelRows[0] as {
            id: string; ad: string; email: string; rol: string;
            aktif: boolean; yetkiler: Record<string, boolean>;
            sifre: string; kullanici_adi: string;
          };
          await clearFailedAttempts(clientIP);
          const token = createToken(p.kullanici_adi || p.email || username, p.rol || 'teknisyen', 'personel');
          const res = NextResponse.json({
            success: true,
            username: p.kullanici_adi || p.email || username,
            rol: p.rol || 'teknisyen',
            kaynak: 'personel',
            adSoyad: p.ad,
            personelId: p.id,
            yetkiler: p.yetkiler || {}
          });
          setTokenCookie(res, token);
          return res;
        }
      } catch (personelErr) {
        console.error('[AUTH] Personel tablo hatası:', personelErr);
        // Hata olsa bile admin kontrolüne düşmüş, admin de tutmadıysa 401 dönsün
      }

      // 3) Hiçbiri eşleşmediyse
      await recordFailedAttempt(clientIP);
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

      // Admin tokenleri için basit yanıt
      if (payload.kaynak === 'admin' || !payload.kaynak) {
        return NextResponse.json({
          success: true,
          authenticated: true,
          username: payload.sub,
          rol: payload.rol || 'super_admin',
          kaynak: 'admin',
          adSoyad: 'Yönetici',
          yetkiler: {
            randevu: true, odeme: true, fatura: true, fiyat: true,
            rapor: true, bayi: true, ayarlar: true, personel: true
          }
        });
      }

      // Personel tokenleri için DB'den güncel bilgi çek
      try {
        const personelRows = await sql`
          SELECT id, ad, email, rol, aktif, yetkiler, kullanici_adi
          FROM personel
          WHERE aktif = TRUE
            AND (
              LOWER(kullanici_adi) = LOWER(${payload.sub})
              OR LOWER(email) = LOWER(${payload.sub})
            )
          LIMIT 1
        `;
        if (personelRows.length === 0) {
          // Personel pasif edilmişse veya silinmişse oturumu kapat
          const res = NextResponse.json({ success: false, authenticated: false, reason: 'personel_inactive' });
          clearTokenCookie(res);
          return res;
        }
        const p = personelRows[0] as {
          id: string; ad: string; email: string; rol: string;
          aktif: boolean; yetkiler: Record<string, boolean>;
          kullanici_adi: string;
        };
        return NextResponse.json({
          success: true,
          authenticated: true,
          username: p.kullanici_adi || p.email || payload.sub,
          rol: p.rol || payload.rol,
          kaynak: 'personel',
          adSoyad: p.ad,
          personelId: p.id,
          yetkiler: p.yetkiler || {}
        });
      } catch (e) {
        console.error('[AUTH] check_session personel hatası:', e);
        // Fallback - token bilgisiyle dön
        return NextResponse.json({
          success: true,
          authenticated: true,
          username: payload.sub,
          rol: payload.rol,
          kaynak: payload.kaynak,
          yetkiler: {}
        });
      }
    }

    // ── UPDATE CREDENTIALS (auth gerekli - SADECE ADMIN) ──────────
    if (action === 'update') {
      const token = req.cookies.get(TOKEN_COOKIE)?.value;
      if (!token) {
        return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 });
      }
      const payload = verifyToken(token);
      if (!payload) {
        return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 });
      }
      // Sadece admin kaynaklı token'lar admin şifresini değiştirebilir
      if (payload.kaynak !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Yalnızca yöneticiler yapabilir' },
          { status: 403 }
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
  return NextResponse.json({
    authenticated: true,
    username: payload.sub,
    rol: payload.rol || 'super_admin',
    kaynak: payload.kaynak || 'admin'
  });
}
