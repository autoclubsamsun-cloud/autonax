import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const rows = await sql`SELECT * FROM urunler WHERE aktif=true ORDER BY id`;
    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const b = await req.json();
    if (Array.isArray(b)) {
      for (const u of b) {
        await sql`
          INSERT INTO urunler (id, isim, kat, alt_kat, garanti, full_fiyat, on3_fiyat, kaput_fiyat, tutar, bayi_indirim, rozet, aciklama, resim)
          VALUES (
            ${u.id || u.kod || 'u' + Date.now()},
            ${u.isim || ''},
            ${u.kat || 'ppf'},
            ${u.altKat || ''},
            ${u.garanti || 5},
            ${u.full || 0},
            ${u.on3 || 0},
            ${u.kaput || 0},
            ${u.tutar || 0},
            ${u.bayiIndirim || 0},
            ${u.rozet || ''},
            ${u.aciklama || ''},
            ${u.resim || null}
          )
          ON CONFLICT (id) DO UPDATE SET
            isim = ${u.isim || ''},
            kat = ${u.kat || 'ppf'},
            alt_kat = ${u.altKat || ''},
            garanti = ${u.garanti || 5},
            full_fiyat = ${u.full || 0},
            on3_fiyat = ${u.on3 || 0},
            kaput_fiyat = ${u.kaput || 0},
            tutar = ${u.tutar || 0},
            bayi_indirim = ${u.bayiIndirim || 0},
            rozet = ${u.rozet || ''},
            aciklama = ${u.aciklama || ''},
            resim = ${u.resim || null},
            guncelleme = NOW()
        `;
      }
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: 'Dizi gerekli' }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
