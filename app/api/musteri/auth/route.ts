import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// ══════════════════════════════════════════════════════════════════
// MÜŞTERİ AUTH — Üye olma, giriş, oturum, profil güncelleme
// ══════════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════════
// Rate Limit Koruması — Brute force ve spam kayıt engellemesi
// ══════════════════════════════════════════════════════════════════
// LOGIN:    1 dk içinde 5 yanlış → 15 dk kilit
// REGISTER: 10 dk içinde 5 kayıt → 30 dk kilit
// ══════════════════════════════════════════════════════════════════

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MIN = 1;
const LOGIN_LOCKOUT_MIN = 15;

const REGISTER_MAX_ATTEMPTS = 5;
const REGISTER_WINDOW_MIN = 10;
const REGISTER_LOCKOUT_MIN = 30;

let musteriRateTableReady = false;
async function ensureMusteriRateTable() {
  if (musteriRateTableReady) return;
  await sql`CREATE TABLE IF NOT EXISTS musteri_rate_limit (
    ip TEXT NOT NULL,
    action_type TEXT NOT NULL,
    fail_count INTEGER NOT NULL DEFAULT 0,
    first_fail_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ,
    PRIMARY KEY (ip, action_type)
  )`;
  musteriRateTableReady = true;
}

function getClientIP(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}

/**
 * IP+action_type için rate limit kontrolü.
 * Kilitliyse → { blocked: true, retryAfterSec }
 */
async function checkMusteriRateLimit(ip: string, actionType: 'login' | 'register'): Promise<{ blocked: boolean; retryAfterSec?: number }> {
  try {
    await ensureMusteriRateTable();
    const rows = await sql`
      SELECT fail_count, first_fail_at, locked_until
      FROM musteri_rate_limit
      WHERE ip = ${ip} AND action_type = ${actionType}
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
      await sql`DELETE FROM musteri_rate_limit WHERE ip = ${ip} AND action_type = ${actionType}`;
    }
    return { blocked: false };
  } catch (e) {
    console.error('[MUSTERI AUTH] Rate limit kontrol hatası:', e);
    // Hata olursa engelleme — sistem çalışmaya devam etsin
    return { blocked: false };
  }
}

/** Sayacı artır, gerekirse kilitle */
async function recordMusteriAttempt(ip: string, actionType: 'login' | 'register'): Promise<void> {
  try {
    await ensureMusteriRateTable();
    const windowMin = actionType === 'login' ? LOGIN_WINDOW_MIN : REGISTER_WINDOW_MIN;
    const maxAttempts = actionType === 'login' ? LOGIN_MAX_ATTEMPTS : REGISTER_MAX_ATTEMPTS;
    const lockoutMin = actionType === 'login' ? LOGIN_LOCKOUT_MIN : REGISTER_LOCKOUT_MIN;

    const rows = await sql`
      SELECT fail_count, first_fail_at FROM musteri_rate_limit
      WHERE ip = ${ip} AND action_type = ${actionType} LIMIT 1
    `;
    if (rows.length === 0) {
      await sql`INSERT INTO musteri_rate_limit (ip, action_type, fail_count, first_fail_at)
        VALUES (${ip}, ${actionType}, 1, NOW())`;
      return;
    }
    const r = rows[0] as { fail_count: number; first_fail_at: string };
    const windowStart = new Date(r.first_fail_at).getTime();
    const elapsedMin = (Date.now() - windowStart) / 60000;
    if (elapsedMin > windowMin) {
      // Pencere geçmiş → sayacı sıfırla
      await sql`UPDATE musteri_rate_limit SET fail_count = 1, first_fail_at = NOW(), locked_until = NULL
        WHERE ip = ${ip} AND action_type = ${actionType}`;
      return;
    }
    const newCount = r.fail_count + 1;
    if (newCount >= maxAttempts) {
      const lockUntil = new Date(Date.now() + lockoutMin * 60000);
      await sql`UPDATE musteri_rate_limit SET fail_count = ${newCount}, locked_until = ${lockUntil.toISOString()}
        WHERE ip = ${ip} AND action_type = ${actionType}`;
    } else {
      await sql`UPDATE musteri_rate_limit SET fail_count = ${newCount}
        WHERE ip = ${ip} AND action_type = ${actionType}`;
    }
  } catch (e) {
    console.error('[MUSTERI AUTH] Failed attempt kayıt hatası:', e);
  }
}

/** Başarılı işlem sonrası sayacı sıfırla */
async function clearMusteriAttempts(ip: string, actionType: 'login' | 'register'): Promise<void> {
  try {
    await ensureMusteriRateTable();
    await sql`DELETE FROM musteri_rate_limit WHERE ip = ${ip} AND action_type = ${actionType}`;
  } catch (e) {
    console.error('[MUSTERI AUTH] Clear attempts hatası:', e);
  }
}

// ══════════════════════════════════════════════════════════════════
// POST — Tüm aksiyonlar
// ══════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    await ensureDB();
    const body = await req.json();
    const { action } = body;

    // ──────────────────────────────────────────────────────────────
    // REGISTER
    // ──────────────────────────────────────────────────────────────
    if (action === 'register') {
      // Rate limit: 10 dk içinde 5 kayıt → 30 dk kilit (spam koruması)
      const clientIP = getClientIP(req);
      const rateCheck = await checkMusteriRateLimit(clientIP, 'register');
      if (rateCheck.blocked) {
        const dakika = Math.ceil((rateCheck.retryAfterSec || 0) / 60);
        return NextResponse.json(
          { success: false, error: `Çok fazla kayıt denemesi. ${dakika} dakika sonra tekrar deneyin.` },
          { status: 429 }
        );
      }

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
        await recordMusteriAttempt(clientIP, 'register');
        return NextResponse.json({ success: false, error: 'Bu e-posta zaten kayıtlı' }, { status: 409 });
      }

      const mevcutTel = await sql`
        SELECT id, sifre_hash FROM musteriler WHERE tel = ${tel} LIMIT 1
      `;
      if (mevcutTel.length > 0 && mevcutTel[0].sifre_hash) {
        await recordMusteriAttempt(clientIP, 'register');
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
      // Başarılı kayıtlar da sayılır (10 dk içinde 5 kayıt limiti)
      await recordMusteriAttempt(clientIP, 'register');
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
      // Rate limit: 1 dk içinde 5 yanlış → 15 dk kilit (brute force koruması)
      const clientIP = getClientIP(req);
      const rateCheck = await checkMusteriRateLimit(clientIP, 'login');
      if (rateCheck.blocked) {
        const dakika = Math.ceil((rateCheck.retryAfterSec || 0) / 60);
        return NextResponse.json(
          { success: false, error: `Çok fazla başarısız deneme. ${dakika} dakika sonra tekrar deneyin.` },
          { status: 429 }
        );
      }

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
        await recordMusteriAttempt(clientIP, 'login');
        return NextResponse.json({ success: false, error: 'E-posta veya şifre hatalı' }, { status: 401 });
      }

      const m: any = rows[0];
      if (!m.aktif) {
        return NextResponse.json({ success: false, error: 'Hesap aktif değil' }, { status: 403 });
      }

      const dogru = await bcrypt.compare(sifre, m.sifre_hash);
      if (!dogru) {
        await recordMusteriAttempt(clientIP, 'login');
        return NextResponse.json({ success: false, error: 'E-posta veya şifre hatalı' }, { status: 401 });
      }

      await sql`UPDATE musteriler SET son_giris = NOW() WHERE id = ${m.id}`.catch(() => {});
      // Başarılı login → sayacı temizle
      await clearMusteriAttempts(clientIP, 'login');

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

// ══════════════════════════════════════════════════════════════════
// GET — Hızlı oturum kontrolü
// ══════════════════════════════════════════════════════════════════

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
