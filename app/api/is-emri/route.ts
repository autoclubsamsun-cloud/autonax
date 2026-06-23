import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';

async function ensureDB() { await initDB(); }

// Takip kodu üretici (6 karakter: büyük harf + rakam)
function takipKoduUret(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışıklık olmaması için 0,O,1,I çıkarıldı
  let kod = '';
  for (let i = 0; i < 6; i++) kod += chars[Math.floor(Math.random() * chars.length)];
  return kod;
}

// Varsayılan aşamalar
function varsayilanAsamalar() {
  return [
    { kod: 'kabul', ad: 'Kabul', durum: 'bekliyor', fotograflar: [] },
    { kod: 'yikama', ad: 'Yıkama', durum: 'bekliyor', fotograflar: [] },
    { kod: 'hazirlik', ad: 'Hazırlık', durum: 'bekliyor', fotograflar: [] },
    { kod: 'uygulama', ad: 'Uygulama', durum: 'bekliyor', fotograflar: [] },
    { kod: 'kalite', ad: 'Kalite Kontrol', durum: 'bekliyor', fotograflar: [] },
    { kod: 'teslim', ad: 'Teslim', durum: 'bekliyor', fotograflar: [] },
  ];
}

// GET - Tüm iş emirleri veya tekil sorgu
export async function GET(req: NextRequest) {
  try {
    await ensureDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const takip = searchParams.get('takip');

    // Public takip kodu ile sorgu (loginsiz)
    if (takip) {
      const rows = await sql`SELECT * FROM is_emirleri WHERE takip_kodu = ${takip}`;
      if (!rows.length) return NextResponse.json({ success: false, error: 'Takip kodu bulunamadı' });
      const ie = rows[0];
      // Public'e sadece gerekli bilgileri ver (tel gizle)
      return NextResponse.json({
        success: true,
        data: {
          takip_kodu: ie.takip_kodu,
          plaka: ie.plaka,
          arac: ie.arac,
          hizmet: ie.hizmet,
          durum: ie.durum,
          mevcut_asama: ie.mevcut_asama,
          asamalar: ie.asamalar,
          olusturma: ie.olusturma,
          tamamlanma: ie.tamamlanma,
        }
      });
    }

    // Tekil iş emri
    if (id) {
      const rows = await sql`SELECT * FROM is_emirleri WHERE id = ${id}`;
      if (!rows.length) return NextResponse.json({ success: false, error: 'İş emri bulunamadı' });
      return NextResponse.json({ success: true, data: rows[0] });
    }

    // Tüm iş emirleri
    const rows = await sql`SELECT * FROM is_emirleri ORDER BY olusturma DESC`;
    return NextResponse.json({ success: true, data: rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST - Yeni iş emri oluştur
export async function POST(req: NextRequest) {
  try {
    await ensureDB();
    const body = await req.json();
    const { musteri, tel, plaka, arac, hizmet, tutar, randevu_id } = body;

    if (!musteri || !plaka) {
      return NextResponse.json({ success: false, error: 'Müşteri ve plaka zorunludur' });
    }

    // Aynı randevuya zaten iş emri var mı?
    if (randevu_id) {
      const existing = await sql`SELECT id FROM is_emirleri WHERE randevu_id = ${randevu_id} AND durum != 'iptal'`;
      if (existing.length) {
        return NextResponse.json({ success: false, error: 'Bu randevuya zaten iş emri oluşturulmuş', is_emri_id: existing[0].id });
      }
    }

    const id = 'ie_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    
    // Benzersiz takip kodu üret
    let takipKodu = '';
    let attempts = 0;
    while (attempts < 10) {
      takipKodu = takipKoduUret();
      const check = await sql`SELECT id FROM is_emirleri WHERE takip_kodu = ${takipKodu}`;
      if (!check.length) break;
      attempts++;
    }

    const asamalar = varsayilanAsamalar();
    // İlk aşamayı (kabul) otomatik başlat
    asamalar[0].durum = 'devam';
    (asamalar[0] as Record<string, unknown>).baslama = new Date().toISOString();

    await sql`INSERT INTO is_emirleri (id, takip_kodu, randevu_id, musteri, tel, plaka, arac, hizmet, tutar, durum, mevcut_asama, asamalar)
      VALUES (${id}, ${takipKodu}, ${randevu_id || null}, ${musteri}, ${tel || ''}, ${plaka}, ${arac || ''}, ${hizmet || ''}, ${tutar || 0}, 'aktif', 'kabul', ${JSON.stringify(asamalar)})`;

    return NextResponse.json({ success: true, id, takip_kodu: takipKodu });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT - Aşama güncelle
export async function PUT(req: NextRequest) {
  try {
    await ensureDB();
    const body = await req.json();
    const { id, aksiyon, asama_kod, not: notText, fotograf, personel, saatler } = body;

    if (!id) return NextResponse.json({ success: false, error: 'ID zorunlu' });

    const rows = await sql`SELECT * FROM is_emirleri WHERE id = ${id}`;
    if (!rows.length) return NextResponse.json({ success: false, error: 'İş emri bulunamadı' });

    const ie = rows[0];
    const asamalar = ie.asamalar as Array<Record<string, unknown>>;
    const now = new Date().toISOString();

    if (aksiyon === 'asama_baslat') {
      // Belirtilen aşamayı başlat
      const asama = asamalar.find((a: Record<string, unknown>) => a.kod === asama_kod);
      if (!asama) return NextResponse.json({ success: false, error: 'Aşama bulunamadı' });
      asama.durum = 'devam';
      asama.baslama = now;
      if (personel) asama.personel = personel;

      await sql`UPDATE is_emirleri SET asamalar = ${JSON.stringify(asamalar)}, mevcut_asama = ${asama_kod}, guncelleme = NOW() WHERE id = ${id}`;
      const updated1 = await sql`SELECT * FROM is_emirleri WHERE id = ${id}`;
      return NextResponse.json({ success: true, mevcut_asama: asama_kod, data: updated1[0] });
    }

    if (aksiyon === 'asama_tamamla') {
      // Mevcut aşamayı tamamla
      const asamaIdx = asamalar.findIndex((a: Record<string, unknown>) => a.kod === asama_kod);
      if (asamaIdx < 0) return NextResponse.json({ success: false, error: 'Aşama bulunamadı' });
      
      const asama = asamalar[asamaIdx];
      asama.durum = 'tamamlandi';
      asama.bitis = now;
      if (notText) asama.not = notText;
      if (personel) asama.personel = personel;
      
      // Süre hesapla
      if (asama.baslama) {
        const sureDk = Math.round((new Date(now).getTime() - new Date(asama.baslama as string).getTime()) / 60000);
        asama.sure_dk = sureDk;
      }

      // Sonraki aşamayı başlat
      let yeniMevcutAsama = asama_kod;
      let durum = ie.durum;
      let tamamlanma = null;

      if (asamaIdx < asamalar.length - 1) {
        const sonraki = asamalar[asamaIdx + 1];
        sonraki.durum = 'devam';
        sonraki.baslama = now;
        yeniMevcutAsama = sonraki.kod as string;
      } else {
        // Son aşama (teslim) tamamlandı → iş emri tamamlandı
        durum = 'tamamlandi';
        tamamlanma = now;
        yeniMevcutAsama = 'teslim';
      }

      // Toplam süre hesapla
      let toplamSure = 0;
      asamalar.forEach((a: Record<string, unknown>) => {
        if (a.sure_dk) toplamSure += a.sure_dk as number;
      });

      await sql`UPDATE is_emirleri SET asamalar = ${JSON.stringify(asamalar)}, mevcut_asama = ${yeniMevcutAsama}, durum = ${durum}, toplam_sure = ${toplamSure}, tamamlanma = ${tamamlanma}, guncelleme = NOW() WHERE id = ${id}`;
      
      const updated2 = await sql`SELECT * FROM is_emirleri WHERE id = ${id}`;
      return NextResponse.json({ success: true, mevcut_asama: yeniMevcutAsama, durum, toplam_sure: toplamSure, data: updated2[0] });
    }

    if (aksiyon === 'fotograf_ekle') {
      const asama = asamalar.find((a: Record<string, unknown>) => a.kod === asama_kod);
      if (!asama) return NextResponse.json({ success: false, error: 'Aşama bulunamadı' });
      if (!Array.isArray(asama.fotograflar)) asama.fotograflar = [];
      (asama.fotograflar as string[]).push(fotograf);
      
      await sql`UPDATE is_emirleri SET asamalar = ${JSON.stringify(asamalar)}, guncelleme = NOW() WHERE id = ${id}`;
      return NextResponse.json({ success: true });
    }

    if (aksiyon === 'not_ekle') {
      const asama = asamalar.find((a: Record<string, unknown>) => a.kod === asama_kod);
      if (!asama) return NextResponse.json({ success: false, error: 'Aşama bulunamadı' });
      asama.not = notText;
      
      await sql`UPDATE is_emirleri SET asamalar = ${JSON.stringify(asamalar)}, guncelleme = NOW() WHERE id = ${id}`;
      return NextResponse.json({ success: true });
    }

    
    if (aksiyon === 'saat_guncelle') {
      // Manuel saat düzenleme — sadece başlama saatleri gelir
      if (!Array.isArray(saatler)) return NextResponse.json({ success: false, error: 'saatler dizisi zorunlu' });
      
      // Önce tüm başlama saatlerini güncelle
      saatler.forEach((s: Record<string, string>) => {
        const asama = asamalar.find((a: Record<string, unknown>) => a.kod === s.kod);
        if (!asama) return;
        if (s.baslama) asama.baslama = new Date(s.baslama).toISOString();
      });

      // Bitiş saatlerini otomatik hesapla: her aşamanın bitişi = sonraki aşamanın başlangıcı
      for (let i = 0; i < asamalar.length; i++) {
        const cur = asamalar[i] as Record<string, unknown>;
        if (cur.durum !== 'tamamlandi') continue;
        if (i < asamalar.length - 1) {
          const next = asamalar[i + 1] as Record<string, unknown>;
          if (next.baslama) cur.bitis = next.baslama;
        }
        if (cur.baslama && cur.bitis) {
          cur.sure_dk = Math.round((new Date(cur.bitis as string).getTime() - new Date(cur.baslama as string).getTime()) / 60000);
        }
      }

      let toplamSure = 0;
      asamalar.forEach((a: Record<string, unknown>) => {
        if (a.sure_dk) toplamSure += a.sure_dk as number;
      });

      await sql`UPDATE is_emirleri SET asamalar = ${JSON.stringify(asamalar)}, toplam_sure = ${toplamSure}, guncelleme = NOW() WHERE id = ${id}`;
      const updated = await sql`SELECT * FROM is_emirleri WHERE id = ${id}`;
      return NextResponse.json({ success: true, data: updated[0] });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz aksiyon' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE - İş emri kalıcı silme
export async function DELETE(req: NextRequest) {
  try {
    await ensureDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID zorunlu' });

    await sql`DELETE FROM is_emirleri WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
