import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════
// MÜŞTERİ AUTH — Üye olma, giriş, oturum, profil güncelleme
// ═══════════════════════════════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET || 'autonax-fallback-secret-degistir';
const TOKEN_COOKIE = 'autonax_musteri_token';
const TOKEN_EXPIRY_HOURS = 24 * 30;
const BCRYPT_ROUNDS = 10;

interface TokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

function createToken(musteriId: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: musteriId, email, iat: now, exp: now + TOKEN_EXPIRY_HOURS * 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expected) return null;
    const payload: TokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function setTokenCookie(res: NextResponse, token: string): void {
  res.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_EXPIRY_HOURS * 3600,
  });
}

function clearTokenCookie(res: NextResponse): void {
  res.cookies.set(TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

function normalizePhone(tel: string): string {
  return (tel || '').replace(/[\s\-()]/g, '');
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(tel: string): boolean {
  const cleaned = normalizePhone(tel);
  return /^(\+?9?0?)?5\d{9}$/.test(cleaned);
}

function generateMusteriId(): string {
  return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function avatardanIki(ad: string, soyad: string): string {
  const a = (ad || '').trim().charAt(0).toUpperCase();
  const s = (soyad || '').trim().charAt(0).toUpperCase();
  return (a + s) || '??';
}

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

// ═══════════════════════════════════════════════════════════════════
// POST — Tüm aksiyonlar
// ═══════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    await ensureDB();
    const body = await req.json();
    const { action } = body;

    // ──────────────────────────────────────────────────────────────
    // REGISTER
    // ──────────────────────────────────────────────────────────────
    if (action === 'register') {
      const ad = (body.ad || '').trim();
      const soyad = (body.soyad || '').trim();
      const email = normalizeEmail(body.email);
      const tel = normalizePhone(body.tel);
      const sifre = body.sifre || '';

      if (!ad) return NextResponse.json({ success: false, error: 'Ad zorunlu' }, { status: 400 });
      if (!email || !validateEmail(email)) {
        return NextResponse.json({ success: false, error: 'Geçerli e-posta giriniz' }, { status: 400 });
      }
      if (!tel || !validatePhone(tel)) {
        return NextResponse.json({ success: false, error: 'Geçerli telefon numarası giriniz (5XX...)' }, { status: 400 });
      }
      if (!sifre || sifre.length < 8) {
        return NextResponse.json({ success: false, error: 'Şifre en az 8 karakter olmalı' }, { status: 400 });
      }

      const mevcutEmail = await sql`
        SELECT id, sifre_hash FROM musteriler WHERE LOWER(email) = ${email} LIMIT 1
      `;
      if (mevcutEmail.length > 0 && mevcutEmail[0].sifre_hash) {
        return NextResponse.json({ success: false, error: 'Bu e-posta zaten kayıtlı' }, { status: 409 });
      }

      const mevcutTel = await sql`
        SELECT id, sifre_hash FROM musteriler WHERE tel = ${tel} LIMIT 1
      `;
      if (mevcutTel.length > 0 && mevcutTel[0].sifre_hash) {
        return NextResponse.json({ success: false, error: 'Bu telefon numarası zaten kayıtlı' }, { status: 409 });
      }

      const sifreHash = await bcrypt.hash(sifre, BCRYPT_ROUNDS);
      const avatar = avatardanIki(ad, soyad);
      let musteriId: string;

      if (mevcutEmail.length > 0) {
        musteriId = mevcutEmail[0].id;
        await sql`
          UPDATE musteriler SET ad = ${ad}, soyad = ${soyad}, tel = ${tel},
            sifre_hash = ${sifreHash}, avatar = ${avatar},
            puan = COALESCE(puan, 0), seviye = COALESCE(seviye, 'Bronz'),
            son_giris = NOW(), aktif = TRUE
          WHERE id = ${musteriId}
        `;
      } else if (mevcutTel.length > 0) {
        musteriId = mevcutTel[0].id;
        await sql`
          UPDATE musteriler SET ad = ${ad}, soyad = ${soyad}, email = ${email},
            sifre_hash = ${sifreHash}, avatar = ${avatar},
            puan = COALESCE(puan, 0), seviye = COALESCE(seviye, 'Bronz'),
            son_giris = NOW(), aktif = TRUE
          WHERE id = ${musteriId}
        `;
      } else {
        musteriId = generateMusteriId();
        await sql`
          INSERT INTO musteriler (id, ad, soyad, email, tel, sifre_hash, avatar, puan, seviye, aktif, son_giris)
          VALUES (${musteriId}, ${ad}, ${soyad}, ${email}, ${tel}, ${sifreHash}, ${avatar}, 0, 'Bronz', TRUE, NOW())
        `;
      }

      const token = createToken(musteriId, email);
      const res = NextResponse.json({
        success: true,
        user: { id: musteriId, ad, soyad, email, tel, avatar, puan: 0, seviye: 'Bronz' },
      });
      setTokenCookie(res, token);
      return res;
    }

    // ──────────────────────────────────────────────────────────────
    // LOGIN
    // ──────────────────────────────────────────────────────────────
    if (action === 'login') {
      const email = normalizeEmail(body.email);
      const sifre = body.sifre || '';

      if (!email || !sifre) {
        return NextResponse.json({ success: false, error: 'E-posta ve şifre gerekli' }, { status: 400 });
      }

      const rows = await sql`
        SELECT id, ad, soyad, email, tel, sifre_hash, avatar, puan, seviye, aktif
        FROM musteriler WHERE LOWER(email) = ${email} LIMIT 1
      `;

      if (rows.length === 0 || !rows[0].sifre_hash) {
        return NextResponse.json({ success: false, error: 'E-posta veya şifre hatalı' }, { status: 401 });
      }

      const m: any = rows[0];
      if (!m.aktif) {
        return NextResponse.json({ success: false, error: 'Hesap aktif değil' }, { status: 403 });
      }

      const dogru = await bcrypt.compare(sifre, m.sifre_hash);
      if (!dogru) {
        return NextResponse.json({ success: false, error: 'E-posta veya şifre hatalı' }, { status: 401 });
      }

      await sql`UPDATE musteriler SET son_giris = NOW() WHERE id = ${m.id}`.catch(() => {});

      const token = createToken(m.id, m.email);
      const res = NextResponse.json({
        success: true,
        user: {
          id: m.id, ad: m.ad, soyad: m.soyad, email: m.email, tel: m.tel,
          avatar: m.avatar, puan: m.puan || 0, seviye: m.seviye || 'Bronz',
        },
      });
      setTokenCookie(res, token);
      return res;
    }

    // ──────────────────────────────────────────────────────────────
    // LOGOUT
    // ──────────────────────────────────────────────────────────────
    if (action === 'logout') {
      const res = NextResponse.json({ success: true });
      clearTokenCookie(res);
      return res;
    }

    // ──────────────────────────────────────────────────────────────
    // CHECK_SESSION
    // ──────────────────────────────────────────────────────────────
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

      const rows = await sql`
        SELECT id, ad, soyad, email, tel, avatar, puan, seviye, aktif
        FROM musteriler WHERE id = ${payload.sub} LIMIT 1
      `;

      if (rows.length === 0 || !rows[0].aktif) {
        const res = NextResponse.json({ success: false, authenticated: false });
        clearTokenCookie(res);
        return res;
      }

      const m: any = rows[0];
      return NextResponse.json({
        success: true,
        authenticated: true,
        user: {
          id: m.id, ad: m.ad, soyad: m.soyad, email: m.email, tel: m.tel,
          avatar: m.avatar, puan: m.puan || 0, seviye: m.seviye || 'Bronz',
        },
      });
    }

    // ──────────────────────────────────────────────────────────────
    // UPDATE_PROFILE — YENİ (Sprint 2A)
    // ──────────────────────────────────────────────────────────────
    // Auth: kendi cookie'siyle gelmeli, başkasının ID'sini değiştiremez
    // Patch: ad, soyad, tel, sehir
    // Email/şifre değişimi YOK (ayrı flow gerek)
    // Telefon değişiyorsa unique kontrolü
    // ──────────────────────────────────────────────────────────────
    if (action === 'update_profile') {
      const token = req.cookies.get(TOKEN_COOKIE)?.value;
      if (!token) {
        return NextResponse.json({ success: false, error: 'Giriş gerekli' }, { status: 401 });
      }
      const payload = verifyToken(token);
      if (!payload) {
        return NextResponse.json({ success: false, error: 'Oturum geçersiz' }, { status: 401 });
      }

      // Mevcut kullanıcı kontrol
      const mevcut = await sql`
        SELECT id, ad, soyad, email, tel, avatar, puan, seviye, sehir, aktif
        FROM musteriler WHERE id = ${payload.sub} LIMIT 1
      `;
      if (mevcut.length === 0 || !mevcut[0].aktif) {
        return NextResponse.json({ success: false, error: 'Kullanıcı bulunamadı' }, { status: 404 });
      }
      const eskiM: any = mevcut[0];

      // Patch — sadece izin verilen alanlar
      const ad = body.ad !== undefined ? String(body.ad).trim() : eskiM.ad;
      const soyad = body.soyad !== undefined ? String(body.soyad).trim() : eskiM.soyad;
      const tel = body.tel !== undefined ? normalizePhone(body.tel) : eskiM.tel;
      const sehir = body.sehir !== undefined ? String(body.sehir).trim() : eskiM.sehir;

      // Validation
      if (!ad) {
        return NextResponse.json({ success: false, error: 'Ad zorunlu' }, { status: 400 });
      }
      if (tel && !validatePhone(tel)) {
        return NextResponse.json(
          { success: false, error: 'Geçerli telefon numarası giriniz' },
          { status: 400 }
        );
      }

      // Telefon değişiyorsa unique kontrolü
      if (tel && tel !== eskiM.tel) {
        const telKullaniliyor = await sql`
          SELECT id FROM musteriler
          WHERE tel = ${tel} AND id != ${payload.sub} LIMIT 1
        `;
        if (telKullaniliyor.length > 0) {
          return NextResponse.json(
            { success: false, error: 'Bu telefon numarası başka bir hesaba ait' },
            { status: 409 }
          );
        }
      }

      // Avatar — ad/soyad değiştiyse otomatik güncelle
      const yeniAvatar = (ad !== eskiM.ad || soyad !== eskiM.soyad)
        ? avatardanIki(ad, soyad)
        : eskiM.avatar;

      await sql`
        UPDATE musteriler SET
          ad = ${ad}, soyad = ${soyad}, tel = ${tel},
          sehir = ${sehir}, avatar = ${yeniAvatar}
        WHERE id = ${payload.sub}
      `;

      return NextResponse.json({
        success: true,
        user: {
          id: payload.sub,
          ad, soyad, email: eskiM.email, tel,
          avatar: yeniAvatar,
          puan: eskiM.puan || 0,
          seviye: eskiM.seviye || 'Bronz',
          sehir,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem' }, { status: 400 });
  } catch (e: any) {
    console.error('[MUSTERI AUTH] Hata:', e);
    return NextResponse.json({ success: false, error: e.message || 'Sunucu hatası' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════
// GET — Hızlı oturum kontrolü
// ═══════════════════════════════════════════════════════════════════

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
    musteriId: payload.sub,
    email: payload.email,
  });
}
