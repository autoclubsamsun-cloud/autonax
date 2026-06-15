import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() { if (!dbReady) { await initDB(); dbReady = true; } }

// ─── Puan ayarlarini DB'den oku ───
async function puanAyarlari() {
  try {
    const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar = 'puan_ayar' LIMIT 1`;
    if (rows.length > 0) {
      const cfg = typeof rows[0].deger === 'string' ? JSON.parse(rows[0].deger) : rows[0].deger;
      return {
        puanTlOrani: cfg.puanTlOrani || 10,
        kazanimYuzde: cfg.kazanimYuzde || 5,
        maxIndirimYuzde: cfg.maxIndirimYuzde || 50,
        seviyeler: cfg.seviyeler || { gumus: 5, altin: 15, platin: 30 },
        carpanlar: cfg.carpanlar || { bronz: 1, gumus: 1.25, altin: 1.5, platin: 2 },
      };
    }
  } catch (e) {}
  return { puanTlOrani: 10, kazanimYuzde: 5, maxIndirimYuzde: 50,
    seviyeler: { gumus: 5, altin: 15, platin: 30 },
    carpanlar: { bronz: 1, gumus: 1.25, altin: 1.5, platin: 2 } };
}

// ─── Seviye hesapla ───
function hesaplaSeviye(refSayisi: number, esikler: any) {
  if (refSayisi >= (esikler.platin || 30)) return 'Platin';
  if (refSayisi >= (esikler.altin || 15)) return 'Altin';
  if (refSayisi >= (esikler.gumus || 5)) return 'Gumus';
  return 'Bronz';
}

function seviyeRozet(s: string) {
  if (s === 'Platin') return '\uD83D\uDC8E';
  if (s === 'Altin') return '\uD83E\uDD47';
  if (s === 'Gumus') return '\uD83E\uDD48';
  return '\uD83E\uDD49';
}

// GET — Referanslari listele
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const { searchParams } = new URL(req.url);
    const tel = searchParams.get('tel') || '';
    const ozet = searchParams.get('ozet') === '1';

    if (ozet) {
      // Referans musteri ozet listesi (kartlar icin)
      const rows = await sql`
        SELECT referans_tel, referans_musteri,
          COUNT(*)::int AS toplam_referans,
          SUM(CASE WHEN durum='onaylandi' THEN 1 ELSE 0 END)::int AS onayli_referans,
          COALESCE(SUM(kazanilan_puan),0)::int AS toplam_puan,
          MAX(olusturma) AS son_referans
        FROM referanslar
        WHERE referans_tel IS NOT NULL AND referans_tel != ''
        GROUP BY referans_tel, referans_musteri
        ORDER BY toplam_referans DESC
      `;
      const ayar = await puanAyarlari();
      const result = rows.map((r: any) => {
        const seviye = hesaplaSeviye(r.onayli_referans, ayar.seviyeler);
        return {
          ...r,
          seviye,
          rozet: seviyeRozet(seviye),
          carpan: (ayar.carpanlar as any)[seviye.toLowerCase()] || 1,
        };
      });
      return NextResponse.json({ success: true, data: result, ayar });
    }

    if (tel) {
      // Belirli musterinin referanslari
      const rows = await sql`SELECT * FROM referanslar WHERE referans_tel = ${tel} ORDER BY olusturma DESC`;
      return NextResponse.json({ success: true, data: rows });
    }

    const rows = await sql`SELECT * FROM referanslar ORDER BY olusturma DESC LIMIT 500`;
    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST — Yeni referans ekle
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const b = await req.json();
    const id = b.id || ('ref_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));

    await sql`
      INSERT INTO referanslar (id, referans_musteri, referans_tel, hedef_randevu_id, hedef_musteri, hedef_hizmet, hedef_tutar, kazanilan_puan, durum, notlar)
      VALUES (${id}, ${b.referans_musteri || ''}, ${b.referans_tel || ''}, ${b.hedef_randevu_id || null}, ${b.hedef_musteri || ''}, ${b.hedef_hizmet || ''}, ${b.hedef_tutar || 0}, ${b.kazanilan_puan || 0}, ${b.durum || 'beklemede'}, ${b.notlar || ''})
    `;

    // Durum onaylandi ise puan kaydi olustur
    if (b.durum === 'onaylandi' && b.kazanilan_puan > 0 && b.referans_tel) {
      const bakiye = await puanBakiyeHesapla(b.referans_tel);
      const yeniBakiye = bakiye + b.kazanilan_puan;
      await sql`
        INSERT INTO puan_hareketleri (musteri_tel, islem_tipi, miktar, bakiye, aciklama, referans_id, randevu_id)
        VALUES (${b.referans_tel}, 'kazanim', ${b.kazanilan_puan}, ${yeniBakiye}, ${b.aciklama || (b.hedef_musteri + ' referansi - ' + b.hedef_hizmet)}, ${id}, ${b.hedef_randevu_id || null})
      `;
    }

    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// PUT — Referans guncelle / onayla
export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const b = await req.json();
    if (!b.id) return NextResponse.json({ success: false, error: 'ID gerekli' }, { status: 400 });

    await sql`
      UPDATE referanslar SET
        referans_musteri = COALESCE(${b.referans_musteri}, referans_musteri),
        referans_tel = COALESCE(${b.referans_tel}, referans_tel),
        hedef_musteri = COALESCE(${b.hedef_musteri}, hedef_musteri),
        hedef_hizmet = COALESCE(${b.hedef_hizmet}, hedef_hizmet),
        hedef_tutar = COALESCE(${b.hedef_tutar}, hedef_tutar),
        kazanilan_puan = COALESCE(${b.kazanilan_puan}, kazanilan_puan),
        durum = COALESCE(${b.durum}, durum),
        notlar = COALESCE(${b.notlar}, notlar)
      WHERE id = ${b.id}
    `;

    // Onayla aksiyonu: puan kazandir
    if (b.durum === 'onaylandi' && b.kazanilan_puan > 0 && b.referans_tel) {
      // Daha once kazanim yapilmis mi kontrol et
      const existing = await sql`SELECT id FROM puan_hareketleri WHERE referans_id = ${b.id} AND islem_tipi = 'kazanim' LIMIT 1`;
      if (existing.length === 0) {
        const bakiye = await puanBakiyeHesapla(b.referans_tel);
        const yeniBakiye = bakiye + b.kazanilan_puan;
        await sql`
          INSERT INTO puan_hareketleri (musteri_tel, islem_tipi, miktar, bakiye, aciklama, referans_id, randevu_id)
          VALUES (${b.referans_tel}, 'kazanim', ${b.kazanilan_puan}, ${yeniBakiye}, ${b.hedef_musteri + ' referansi'}, ${b.id}, ${b.hedef_randevu_id || null})
        `;
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// DELETE — Referans sil
export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID gerekli' }, { status: 400 });
    await sql`DELETE FROM referanslar WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// Yardimci: puan bakiye hesapla
async function puanBakiyeHesapla(tel: string): Promise<number> {
  try {
    const rows = await sql`
      SELECT COALESCE(SUM(miktar), 0)::int AS bakiye
      FROM puan_hareketleri WHERE musteri_tel = ${tel}
    `;
    return rows[0]?.bakiye || 0;
  } catch (e) { return 0; }
}
