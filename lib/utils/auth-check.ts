import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════
// AUTH CHECK — İki tip token desteği
// ═══════════════════════════════════════════════════════════════════
// Admin/Personel:  autonax_token         (8 saat, sameSite:strict)
// Müşteri:         autonax_musteri_token (30 gün, sameSite:lax)
//
// Helper'lar:
//   requireAuth(req)         → SADECE admin/personel
//   requireMusteriAuth(req)  → SADECE müşteri
//   requireAnyAuth(req)      → her ikisi de OK, hangisi olduğunu döner
// ═══════════════════════════════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET || 'autonax-fallback-secret-degistir';
const ADMIN_COOKIE = 'autonax_token';
const MUSTERI_COOKIE = 'autonax_musteri_token';

interface AdminTokenPayload {
  sub: string;       // username
  rol?: string;
  kaynak?: string;
  iat: number;
  exp: number;
}

interface MusteriTokenPayload {
  sub: string;       // musteri_id
  email: string;
  iat: number;
  exp: number;
}

// ─── JWT verify (auth.ts ile aynı algoritma) ──────────────────────

function verifyTokenGeneric<T>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expected = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (signature !== expected) return null;
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString()
    ) as T & { exp: number };
    if (Date.now() / 1000 > payload.exp) return null;
    return payload as T;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// requireAuth — SADECE ADMIN/PERSONEL (mevcut, dokunulmadı)
// ═══════════════════════════════════════════════════════════════════
//
// Mevcut admin endpoint'lerinin davranışı KORUNDU. Sadece admin token
// geçerli. Müşteri token'ı gönderilse bile reddedilir.
//
// Kullanım:
//   const auth = requireAuth(req);
//   if (auth instanceof NextResponse) return auth; // 401
//   // auth.username kullanılabilir
// ═══════════════════════════════════════════════════════════════════

export function requireAuth(req: NextRequest): { username: string } | NextResponse {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Oturum bulunamadı' },
      { status: 401 }
    );
  }
  const payload = verifyTokenGeneric<AdminTokenPayload>(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, error: 'Oturum süresi dolmuş' },
      { status: 401 }
    );
  }
  return { username: payload.sub };
}

// ═══════════════════════════════════════════════════════════════════
// requireMusteriAuth — SADECE MÜŞTERİ
// ═══════════════════════════════════════════════════════════════════
//
// /api/musteri/* endpoint'lerinde kullanılır. Admin token kabul EDİLMEZ
// (müşteri-özel verileri admin token ile çekmek istenirse,
// requireAnyAuth kullan).
// ═══════════════════════════════════════════════════════════════════

export function requireMusteriAuth(req: NextRequest):
  | { musteriId: string; email: string }
  | NextResponse
{
  const token = req.cookies.get(MUSTERI_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Müşteri girişi gerekli' },
      { status: 401 }
    );
  }
  const payload = verifyTokenGeneric<MusteriTokenPayload>(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, error: 'Müşteri oturumu süresi dolmuş' },
      { status: 401 }
    );
  }
  return { musteriId: payload.sub, email: payload.email };
}

// ═══════════════════════════════════════════════════════════════════
// requireAnyAuth — ADMIN VEYA MÜŞTERİ
// ═══════════════════════════════════════════════════════════════════
//
// Hem admin hem müşterinin erişebileceği endpoint'ler için.
// Örnek: GET /api/randevular — admin tüm randevuları, müşteri sadece
// kendininkini görür. Endpoint kim olduğuna göre filter ekler.
//
// HOTFIX: Admin token öncelikli (önceden müşteri öncelikli idi).
// Sebep: Aynı tarayıcıda iki cookie de olabilir (admin ayrı sekmede
// müşteri olarak da girmişse). Admin endpoint'lerinde admin akışı
// çalışmalı. Endpoint isterse ?mod=musteri ile müşteri akışını
// zorlayabilir.
// ═══════════════════════════════════════════════════════════════════

export type AnyAuthResult =
  | { kim: 'musteri'; musteriId: string; email: string }
  | { kim: 'admin'; username: string };

export function requireAnyAuth(req: NextRequest): AnyAuthResult | NextResponse {
  // 1) Admin token önce
  const adminToken = req.cookies.get(ADMIN_COOKIE)?.value;
  if (adminToken) {
    const payload = verifyTokenGeneric<AdminTokenPayload>(adminToken);
    if (payload) {
      return { kim: 'admin', username: payload.sub };
    }
  }

  // 2) Müşteri token
  const musteriToken = req.cookies.get(MUSTERI_COOKIE)?.value;
  if (musteriToken) {
    const payload = verifyTokenGeneric<MusteriTokenPayload>(musteriToken);
    if (payload) {
      return { kim: 'musteri', musteriId: payload.sub, email: payload.email };
    }
  }

  // 3) İkisi de yoksa
  return NextResponse.json(
    { success: false, error: 'Giriş gerekli' },
    { status: 401 }
  );
}
