import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() { if (!dbReady) { await initDB(); dbReady = true; } }

// GET — Puan bakiye ve hareket gecmisi
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const { searchParams } = new URL(req.url);
    const tel = searchParams.get('tel') || '';

    if (!tel) {
      // Tum musterilerin puan bakiyeleri (ozet)
      const rows = await sql`
        SELECT musteri_tel,
          COALESCE(SUM(miktar), 0)::int AS bakiye,
          COUNT(CASE WHEN islem_tipi='kazanim' THEN 1 END)::int AS kazanim_sayisi,
          COALESCE(SUM(CASE WHEN islem_tipi='kazanim' THEN miktar ELSE 0 END), 0)::int AS toplam_kazanilan,
          COALESCE(SUM(CASE WHEN islem_tipi='harcama' THEN ABS(miktar) ELSE 0 END), 0)::int AS toplam_harcanan
        FROM puan_hareketleri
        GROUP BY musteri_tel
        ORDER BY bakiye DESC
      `;
      return NextResponse.json({ success: true, data: rows });
    }

    // Belirli musterinin bakiye + gecmisi
    const bakiyeRows = await sql`
      SELECT COALESCE(SUM(miktar), 0)::int AS bakiye FROM puan_hareketleri WHERE musteri_tel = ${tel}
    `;
    const gecmis = await sql`
      SELECT * FROM puan_hareketleri WHERE musteri_tel = ${tel} ORDER BY olusturma DESC LIMIT 50
    `;
    // Puan ayarlari
    let ayar = { puanTlOrani: 10, maxIndirimYuzde: 50 };
    try {
      const ar = await sql`SELECT deger FROM site_ayarlar WHERE anahtar = 'puan_ayar' LIMIT 1`;
      if (ar.length > 0) {
        const cfg = typeof ar[0].deger === 'string' ? JSON.parse(ar[0].deger) : ar[0].deger;
        ayar.puanTlOrani = cfg.puanTlOrani || 10;
        ayar.maxIndirimYuzde = cfg.maxIndirimYuzde || 50;
      }
    } catch (e) {}

    return NextResponse.json({
      success: true,
      bakiye: bakiyeRows[0]?.bakiye || 0,
      tlKarsiligi: (bakiyeRows[0]?.bakiye || 0) * ayar.puanTlOrani,
      ayar,
      gecmis,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST — Manuel puan ekle/cikar (admin)
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const b = await req.json();

    if (!b.musteri_tel) return NextResponse.json({ success: false, error: 'Telefon gerekli' }, { status: 400 });
    if (!b.miktar || b.miktar === 0) return NextResponse.json({ success: false, error: 'Miktar gerekli' }, { status: 400 });

    // Guncel bakiye
    const bakiyeRows = await sql`
      SELECT COALESCE(SUM(miktar), 0)::int AS bakiye FROM puan_hareketleri WHERE musteri_tel = ${b.musteri_tel}
    `;
    const mevcutBakiye = bakiyeRows[0]?.bakiye || 0;
    const yeniBakiye = mevcutBakiye + b.miktar;

    // Harcama ise bakiye kontrolu
    if (b.miktar < 0 && yeniBakiye < 0) {
      return NextResponse.json({ success: false, error: 'Yetersiz puan bakiyesi. Mevcut: ' + mevcutBakiye }, { status: 400 });
    }

    await sql`
      INSERT INTO puan_hareketleri (musteri_tel, islem_tipi, miktar, bakiye, aciklama, referans_id, randevu_id)
      VALUES (${b.musteri_tel}, ${b.islem_tipi || (b.miktar > 0 ? 'bonus' : 'harcama')}, ${b.miktar}, ${yeniBakiye}, ${b.aciklama || ''}, ${b.referans_id || null}, ${b.randevu_id || null})
    `;

    return NextResponse.json({ success: true, bakiye: yeniBakiye });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
