import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import crypto from 'crypto';

// ══════════════════════════════════════════════════════════════════
// DASHBOARD İSTATİSTİK — Admin paneli için canlı sayılar
// Sadece admin token'ı olan kullanıcı erişebilir
// ══════════════════════════════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET || 'autonax-fallback-secret-degistir';
const ADMIN_TOKEN_COOKIE = 'autonax_token';

interface TokenPayload {
  sub: string;
  rol: string;
  kaynak: string;
  iat: number;
  exp: number;
}

function verifyAdminToken(token: string): TokenPayload | null {
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

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

export async function GET(req: NextRequest) {
  try {
    // ── Auth: sadece admin token'ı olan görebilir ─────────────────
    const token = req.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 });
    }
    const payload = verifyAdminToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 });
    }

    await ensureDB();

    // ── 4 sayıyı paralel çek ──────────────────────────────────────
    const [toplamRows, bugunRows, aktifRows, kilitRows] = await Promise.all([
      // 1) Toplam aktif kayıtlı müşteri
      sql`SELECT COUNT(*)::int AS sayi FROM musteriler WHERE aktif = TRUE`,
      // 2) Bugün yeni kayıt (UTC bazlı, Türkiye saati ile yaklaşık aynı)
      sql`SELECT COUNT(*)::int AS sayi FROM musteriler
          WHERE aktif = TRUE AND olusturma >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Europe/Istanbul')`,
      // 3) Son 1 saatte aktif (login yapmış)
      sql`SELECT COUNT(*)::int AS sayi FROM musteriler
          WHERE aktif = TRUE AND son_giris > NOW() - INTERVAL '1 hour'`,
      // 4) Şu an kilitli IP sayısı (brute force/spam koruması)
      sql`SELECT COUNT(*)::int AS sayi FROM musteri_rate_limit
          WHERE locked_until > NOW()`.catch(() => [{ sayi: 0 }]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        toplam_uye: (toplamRows[0]?.sayi as number) || 0,
        bugun_yeni: (bugunRows[0]?.sayi as number) || 0,
        son_1_saat_aktif: (aktifRows[0]?.sayi as number) || 0,
        kilitli_ip: (kilitRows[0]?.sayi as number) || 0,
      },
    });
  } catch (e: any) {
    console.error('[DASHBOARD-ISTATISTIK] Hata:', e);
    return NextResponse.json(
      { success: false, error: e.message || 'Sunucu hatası' },
      { status: 500 }
    );
  }
}
