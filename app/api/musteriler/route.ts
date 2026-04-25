import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';

// ═══════════════════════════════════════════════════════════════════
// MÜŞTERİLER LİSTESİ — Admin paneli için
// ═══════════════════════════════════════════════════════════════════
// İki kaynaktan müşteri verisi birleştirir:
//
//   1. randevular tablosu (gerçek)
//      → CSV import + admin'in randevu eklediği müşteriler buradan
//      → musteri + plaka kombinasyonu = unique müşteri
//      → istatistikler: islem sayısı, toplam tutar, son tarih
//
//   2. musteriler tablosu (yeni — üye olanlar için)
//      → Site üzerinden register olan müşteriler
//      → Henüz randevusu yoksa bile listede görünür
//      → uye: true olarak işaretlenir
//
// Eşleştirme mantığı:
//   - musteriler tablosundaki bir email/tel/ad randevular'da varsa
//     birleşik kayıt olarak gösterilir (uye:true + istatistikler)
//   - Sadece randevular'da olan kişi → uye:false
//   - Sadece musteriler'de olan (henüz randevusuz üye) → istatistikler 0
//
// Önceki versiyon RANDEVULAR_DEMO'dan türetiyordu — değiştirildi.
// ═══════════════════════════════════════════════════════════════════

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

// Telefon normalize — eşleştirme için
function normalizeTel(tel: string | null | undefined): string {
  return (tel || '').replace(/[\s\-()]/g, '').replace(/^(\+?9?0?)/, '');
}

export async function GET(req: NextRequest) {
  // SADECE ADMIN/PERSONEL erişebilir
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.toLowerCase().trim() || '';

    // ─── 1) randevular tablosundan müşteri+plaka bazlı aggregate ─────
    const randevuMusteriler = await sql`
      SELECT 
        musteri,
        MAX(tel) AS tel,
        plaka,
        MAX(arac) AS arac,
        COUNT(*)::int AS islem_sayisi,
        COALESCE(SUM(tutar), 0)::int AS toplam_tutar,
        COALESCE(SUM(odenen_toplam), 0)::int AS toplam_odenen,
        MAX(tarih) AS son_tarih
      FROM randevular
      WHERE musteri IS NOT NULL AND musteri != ''
      GROUP BY musteri, plaka
      ORDER BY MAX(olusturma) DESC NULLS LAST
    `;

    // ─── 2) musteriler tablosundan üyeleri çek ──────────────────────
    let dbMusteriler: any[] = [];
    try {
      dbMusteriler = (await sql`
        SELECT 
          m.id, m.ad, m.soyad, m.email, m.tel, m.plaka, m.arac,
          m.avatar, m.puan, m.seviye, m.aktif,
          m.olusturma, m.son_giris,
          (m.sifre_hash IS NOT NULL) AS uye,
          COALESCE(arac_sayi.sayi, 0)::int AS arac_sayisi
        FROM musteriler m
        LEFT JOIN (
          SELECT musteri_id, COUNT(*) AS sayi
          FROM musteri_araclari
          GROUP BY musteri_id
        ) arac_sayi ON arac_sayi.musteri_id = m.id
        ORDER BY m.olusturma DESC NULLS LAST
      `) as any[];
    } catch (musteriErr: any) {
      // Migration çalışmamışsa veya tablo yoksa sessiz geç
      console.warn('[MUSTERILER] musteriler tablosu okunamadı:', musteriErr.message);
      dbMusteriler = [];
    }

    // ─── 3) Üyeleri Map'e at — index'lenmiş ─────────────────────────
    const uyelerByTel = new Map<string, any>();
    const uyelerByPlakaAd = new Map<string, any>();

    const uyeKayitlari = dbMusteriler.map((m: any) => {
      const adSoyad = ((m.ad || '') + ' ' + (m.soyad || '')).trim();
      const kayit = {
        id: m.id,
        isim: adSoyad || m.email || m.tel || 'İsimsiz',
        ad: m.ad || '',
        soyad: m.soyad || '',
        email: m.email || '',
        tel: m.tel || '',
        plaka: m.plaka || '',
        arac: m.arac || '',
        avatar: m.avatar || null,
        puan: m.puan || 0,
        seviye: m.seviye || 'Bronz',
        aktif: m.aktif !== false,
        uye: !!m.uye,
        aracSayisi: m.arac_sayisi || 0,
        olusturma: m.olusturma,
        sonGiris: m.son_giris,
        islemSayisi: 0,
        toplamTutar: 0,
        toplamOdenen: 0,
        sonTarih: '',
      };
      if (m.tel) uyelerByTel.set(normalizeTel(m.tel), kayit);
      if (adSoyad && m.plaka) {
        uyelerByPlakaAd.set((adSoyad + '|' + m.plaka).toLowerCase(), kayit);
      }
      return kayit;
    });

    // ─── 4) Sonuç Map — önce üyeleri ekle, sonra randevuları işle ────
    const sonucMap = new Map<string, any>();

    uyeKayitlari.forEach(u => {
      sonucMap.set('uye_' + u.id, u);
    });

    randevuMusteriler.forEach((r: any) => {
      const isim = r.musteri || '';
      const plaka = r.plaka || '';
      const tel = r.tel || '';

      // Eşleşme arama: ad+plaka → tel
      let mevcutUye = uyelerByPlakaAd.get((isim + '|' + plaka).toLowerCase());
      if (!mevcutUye && tel) mevcutUye = uyelerByTel.get(normalizeTel(tel));

      if (mevcutUye) {
        // Üye + randevu eşleşti → istatistik zenginleştir
        mevcutUye.islemSayisi += r.islem_sayisi;
        mevcutUye.toplamTutar += r.toplam_tutar;
        mevcutUye.toplamOdenen += r.toplam_odenen;
        if (!mevcutUye.sonTarih || r.son_tarih > mevcutUye.sonTarih) {
          mevcutUye.sonTarih = r.son_tarih;
        }
        if (!mevcutUye.plaka && plaka) mevcutUye.plaka = plaka;
        if (!mevcutUye.arac && r.arac) mevcutUye.arac = r.arac;
        if (!mevcutUye.tel && tel) mevcutUye.tel = tel;
      } else {
        // Sadece randevudan tanınan müşteri (üye değil)
        const key = 'rdv_' + isim + '_' + plaka;
        const ex = sonucMap.get(key);
        if (ex) {
          ex.islemSayisi += r.islem_sayisi;
          ex.toplamTutar += r.toplam_tutar;
          ex.toplamOdenen += r.toplam_odenen;
          if (r.son_tarih > ex.sonTarih) ex.sonTarih = r.son_tarih;
        } else {
          sonucMap.set(key, {
            id: key,
            isim: isim,
            ad: isim,
            soyad: '',
            email: '',
            tel: tel,
            plaka: plaka,
            arac: r.arac || '',
            avatar: null,
            puan: 0,
            seviye: 'Bronz',
            aktif: true,
            uye: false,
            aracSayisi: 0,
            olusturma: null,
            sonGiris: null,
            islemSayisi: r.islem_sayisi,
            toplamTutar: r.toplam_tutar,
            toplamOdenen: r.toplam_odenen,
            sonTarih: r.son_tarih,
          });
        }
      }
    });

    // ─── 5) Diziye çevir, filtre, dön ──────────────────────────────
    let data = Array.from(sonucMap.values());

    if (q) {
      data = data.filter(m =>
        (m.isim || '').toLowerCase().includes(q) ||
        (m.plaka || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.tel || '').includes(q) ||
        (m.arac || '').toLowerCase().includes(q)
      );
    }

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch (e: any) {
    console.error('[MUSTERILER GET] Hata:', e);
    return NextResponse.json<ApiResponse>({ success: false, error: e.message }, { status: 500 });
  }
}
