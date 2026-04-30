import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() { if (!dbReady) { await initDB(); dbReady = true; } }

// GET: PUBLIC - site ayarlari (logo, banner, instagram, sosyal medya vb.) anasayfada gosterilir
export async function GET(req: NextRequest) {
  try {
    await ensureDB();
    const rows = await sql`SELECT anahtar, deger FROM site_ayarlar`;
    const ayarlar: any = {};
    rows.forEach((r: any) => { ayarlar[r.anahtar] = r.deger; });
    const site_ayarlar = ayarlar.site_ayarlar || null;
    return NextResponse.json({ success: true, data: ayarlar, site_ayarlar });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

// POST: ADMIN ONLY - ayar guncelleme sadece yetkili kullanici
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const b = await req.json();
    for (const [key, val] of Object.entries(b)) {
      await sql`INSERT INTO site_ayarlar (anahtar, deger) VALUES (${key}, ${JSON.stringify(val)}::jsonb) ON CONFLICT (anahtar) DO UPDATE SET deger=${JSON.stringify(val)}::jsonb, guncelleme=NOW()`;
    }
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
