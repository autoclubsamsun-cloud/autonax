import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════
// MÜŞTERİ ARAÇLARI — Garaj CRUD
// ═══════════════════════════════════════════════════════════════════
// Sadece giriş yapmış müşterinin kendi araçlarına erişimi var.
// Müşteri JWT cookie'si (autonax_musteri_token) gerekli.
// ═══════════════════════════════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET || 'autonax-fallback-secret-degistir';
const TOKEN_COOKIE = 'autonax_musteri_token';

interface TokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

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

/** Auth check — müşteri girişi yapılmış mı? */
function requireMusteriAuth(req: NextRequest): { musteriId: string } | NextResponse {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Giriş yapmalısınız' }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Oturum geçersiz' }, { status: 401 });
  }
  return { musteriId: payload.sub };
}

function normalizePlaka(plaka: string): string {
  return (plaka || '').replace(/\s/g, '').toUpperCase();
}

function generateAracId(): string {
  return 'a_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

// ═══════════════════════════════════════════════════════════════════
// GET — Müşterinin tüm araçları
// ═══════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const auth = requireMusteriAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();
    const rows = await sql`
      SELECT id, plaka, marka, model, yil, renk, varsayilan, eklenme
      FROM musteri_araclari
      WHERE musteri_id = ${auth.musteriId}
      ORDER BY varsayilan DESC, eklenme ASC
    `;
    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    console.error('[MUSTERI ARAC] GET hatası:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════
// POST — Araç ekle veya güncelle
// ═══════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const auth = requireMusteriAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();
    const body = await req.json();
    const plaka = normalizePlaka(body.plaka);
    const marka = (body.marka || '').trim() || null;
    const model = (body.model || '').trim() || null;
    const yil = body.yil ? parseInt(body.yil) : null;
    const renk = (body.renk || '').trim() || null;
    const varsayilan = !!body.varsayilan;

    if (!plaka) {
      return NextResponse.json({ success: false, error: 'Plaka zorunlu' }, { status: 400 });
    }
    if (plaka.length < 4 || plaka.length > 10) {
      return NextResponse.json({ success: false, error: 'Plaka 4-10 karakter olmalı' }, { status: 400 });
    }

    // Aynı kullanıcı aynı plakayı eklemiş mi?
    const mevcut = await sql`
      SELECT id FROM musteri_araclari
      WHERE musteri_id = ${auth.musteriId} AND UPPER(plaka) = ${plaka}
      LIMIT 1
    `;

    let aracId: string;
    if (mevcut.length > 0) {
      // UPDATE
      aracId = mevcut[0].id as string;
      await sql`
        UPDATE musteri_araclari SET
          marka = ${marka},
          model = ${model},
          yil = ${yil},
          renk = ${renk}
        WHERE id = ${aracId}
      `;
    } else {
      // INSERT
      aracId = generateAracId();
      await sql`
        INSERT INTO musteri_araclari (id, musteri_id, plaka, marka, model, yil, renk, varsayilan)
        VALUES (${aracId}, ${auth.musteriId}, ${plaka}, ${marka}, ${model}, ${yil}, ${renk}, ${varsayilan})
      `;
    }

    // Varsayılan ayarlandıysa diğerlerinin varsayılan'ını kapat
    if (varsayilan) {
      await sql`
        UPDATE musteri_araclari SET varsayilan = FALSE
        WHERE musteri_id = ${auth.musteriId} AND id != ${aracId}
      `;
    }

    // Güncel listeyi dön
    const rows = await sql`
      SELECT id, plaka, marka, model, yil, renk, varsayilan, eklenme
      FROM musteri_araclari
      WHERE musteri_id = ${auth.musteriId}
      ORDER BY varsayilan DESC, eklenme ASC
    `;
    return NextResponse.json({ success: true, data: rows, aracId });
  } catch (e: any) {
    console.error('[MUSTERI ARAC] POST hatası:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════
// DELETE — Araç sil (?id=ARAC_ID)
// ═══════════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest) {
  const auth = requireMusteriAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();
    const { searchParams } = new URL(req.url);
    const aracId = searchParams.get('id');

    if (!aracId) {
      return NextResponse.json({ success: false, error: 'id parametresi gerekli' }, { status: 400 });
    }

    // Sadece kendi aracını silebilir (musteri_id kontrolü kritik!)
    const sonuc = await sql`
      DELETE FROM musteri_araclari
      WHERE id = ${aracId} AND musteri_id = ${auth.musteriId}
      RETURNING id
    `;

    if (sonuc.length === 0) {
      return NextResponse.json({ success: false, error: 'Araç bulunamadı veya size ait değil' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[MUSTERI ARAC] DELETE hatası:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
