import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/utils/auth-check';

interface Personel {
  id: string;
  ad: string;
  email?: string;
  tel?: string;
  sifre?: string;
  rol: string;
  aktif: boolean;
  yetkiler: Record<string, boolean>;
  kullaniciAdi?: string;
  kullanici_adi?: string;
  kayit_tarihi?: string;
}

// ── DB init ────────────────────────────────────────────────────────
let dbReady = false;
async function ensureDB() {
  if (dbReady) return;
  await initDB();
  // personel tablosu yoksa olustur
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
  try {
    await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS email TEXT`;
    await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS tel TEXT`;
    await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS sifre TEXT`;
    await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'teknisyen'`;
    await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS aktif BOOLEAN DEFAULT TRUE`;
    await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS yetkiler JSONB DEFAULT '{}'::jsonb`;
    await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS kullanici_adi TEXT`;
    await sql`ALTER TABLE personel ADD COLUMN IF NOT EXISTS kayit_tarihi TIMESTAMPTZ DEFAULT NOW()`;
  } catch (e) {
    console.error('[personel] migrate hata:', e);
  }
  dbReady = true;
}

// DB row -> API object (both camelCase ve snake_case destek)
function rowToPersonel(row: Record<string, unknown>): Personel {
  return {
    id: String(row.id),
    ad: String(row.ad || ''),
    email: (row.email as string) || '',
    tel: (row.tel as string) || '',
    sifre: (row.sifre as string) || '',
    rol: String(row.rol || 'teknisyen'),
    aktif: row.aktif !== false,
    yetkiler: (row.yetkiler as Record<string, boolean>) || {},
    kullaniciAdi: (row.kullanici_adi as string) || '',
    kullanici_adi: (row.kullanici_adi as string) || '',
    kayit_tarihi: (row.kayit_tarihi as string) || undefined,
  };
}

// ── GET: tüm personel (şifre siliner) ──────────────────────────────
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();
    const rows = await sql`SELECT * FROM personel ORDER BY kayit_tarihi DESC`;
    const liste = rows.map(rowToPersonel).map(({ sifre: _, ...p }) => p);
    return NextResponse.json({ success: true, data: liste });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[personel GET]', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── POST: upsert (id varsa guncelle, yoksa ekle) ──────────────────
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();
    const body = await req.json() as Partial<Personel>;

    const id = body.id || `p-${randomUUID().slice(0, 8)}`;
    const ad = (body.ad || '').trim();
    if (!ad) {
      return NextResponse.json({ success: false, error: 'Ad zorunlu' }, { status: 400 });
    }

    const email = (body.email || '').trim();
    const tel = (body.tel || '').trim();
    const sifre = body.sifre || '';
    const rol = body.rol || 'teknisyen';
    const aktif = body.aktif !== false;
    const yetkiler = body.yetkiler || {};
    const kullaniciAdi = (body.kullaniciAdi || body.kullanici_adi || '').trim().toLowerCase();

    await sql`
      INSERT INTO personel (id, ad, email, tel, sifre, rol, aktif, yetkiler, kullanici_adi, kayit_tarihi)
      VALUES (${id}, ${ad}, ${email}, ${tel}, ${sifre}, ${rol}, ${aktif}, ${JSON.stringify(yetkiler)}::jsonb, ${kullaniciAdi}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        ad = EXCLUDED.ad,
        email = EXCLUDED.email,
        tel = EXCLUDED.tel,
        sifre = CASE WHEN EXCLUDED.sifre = '' THEN personel.sifre ELSE EXCLUDED.sifre END,
        rol = EXCLUDED.rol,
        aktif = EXCLUDED.aktif,
        yetkiler = EXCLUDED.yetkiler,
        kullanici_adi = EXCLUDED.kullanici_adi
    `;

    const inserted = await sql`SELECT * FROM personel WHERE id = ${id} LIMIT 1`;
    const p = inserted.length > 0 ? rowToPersonel(inserted[0]) : null;
    const safe = p ? (({ sifre: _, ...rest }) => rest)(p) : null;
    return NextResponse.json({ success: true, data: safe }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[personel POST]', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

// ── PUT: aynı davranış (upsert) ────────────────────────────────────
export async function PUT(req: NextRequest) {
  return POST(req);
}

// ── DELETE: ID ile sil ─────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID gerekli' }, { status: 400 });
    }
    await sql`DELETE FROM personel WHERE id = ${id}`;
    return NextResponse.json({ success: true, message: 'Silindi' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[personel DELETE]', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
