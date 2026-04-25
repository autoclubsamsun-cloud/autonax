/**
 * GET /api/musait-tarihler?baslangic=DD.MM.YYYY&gun=60
 *
 * Müşteri randevu açma modal'ı için kullanılır.
 * Belirtilen tarih aralığında her günün dolu/boş durumunu döner.
 *
 * Kurallar:
 *   - Pazar günleri tamamen kapalı
 *   - Günlük 2 kaplama (PPF + Seramik tam araç) limit
 *   - Sayılan durumlar: bekl + onay + tmm (iptal sayılmaz)
 *   - Limit sadece KAPLAMA hizmetleri için (pasta/yıkama hariç)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     tarihler: [
 *       { tarih: "25.04.2026", durum: "dolu", kaplama_sayisi: 2, dolu_saatler: ["09:00","13:00"] },
 *       { tarih: "26.04.2026", durum: "kapali_pazar" },
 *       { tarih: "27.04.2026", durum: "musait", kaplama_sayisi: 0, dolu_saatler: [] },
 *       ...
 *     ]
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireMusteriAuth } from '@/lib/utils/auth-check';

const GUNLUK_KAPLAMA_LIMIT = 2;

// ─── Hizmet kaplama mı? ───────────────────────────────────────────
// Anahtar kelime tespiti — sıkı regex ile yanlış pozitiften kaçınma
function isKaplamaHizmeti(hizmet: string): boolean {
  if (!hizmet) return false;
  const h = hizmet.toLowerCase();

  // ÖNCE kaplama OLMAYANLAR (öncelikli — daha sıkı)
  // "Ön 3 Parça", "Kaput", "Pasta", "Yıkama", "Detay", "Cila"
  if (/\bön\s*3\s*parça\b|\bkaput\b|\bpasta\b|\byıkama\b|\bdetay\s*temizlik\b|\biç.*dış\s*detay\b|\bcila\b/.test(h)) {
    return false;
  }

  // SONRA kaplama olanlar
  // PPF + Tam Araç / Full / Komple
  if (/ppf/.test(h) && /(tam\s*araç|full\s*araç|komple\s*araç|tam\b)/.test(h)) {
    return true;
  }
  // Seramik kaplama (tüm seramik aslında tam araçtır pratikte)
  if (/seramik\s*kaplama/.test(h)) {
    return true;
  }
  // Kombo / kompozit (PPF + seramik)
  if (/\bkombo\b|\bkompozit\b/.test(h)) {
    return true;
  }

  return false;
}

// Tarih DD.MM.YYYY → Date
function _tariheCevir(t: string): Date | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

// Date → DD.MM.YYYY
function _formatla(d: Date): string {
  const g = String(d.getDate()).padStart(2, '0');
  const a = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  return `${g}.${a}.${y}`;
}

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

export async function GET(req: NextRequest) {
  // Müşteri auth zorunlu
  const auth = requireMusteriAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();
    const { searchParams } = new URL(req.url);
    const baslangicStr = searchParams.get('baslangic');
    const gunSayisi = Math.min(parseInt(searchParams.get('gun') || '60'), 90);

    let baslangic = baslangicStr ? _tariheCevir(baslangicStr) : null;
    if (!baslangic) {
      // Yarın
      baslangic = new Date();
      baslangic.setDate(baslangic.getDate() + 1);
      baslangic.setHours(0, 0, 0, 0);
    }

    // Bitis = baslangic + gunSayisi
    const bitis = new Date(baslangic);
    bitis.setDate(bitis.getDate() + gunSayisi);

    // İlgili tüm randevuları çek (iptal hariç)
    // Tarih DD.MM.YYYY formatında saklanıyor — bu yüzden tek tek karşılaştıracağız
    const rows = await sql`
      SELECT tarih, saat, hizmet, durum
      FROM randevular
      WHERE durum IN ('bekl', 'onay', 'tmm', 'tamamlandi')
    `;

    // Her tarih için kaplama sayısı + dolu saatleri grupla
    const gruplar: Record<string, { kaplama: number; saatler: Set<string>; tumSayi: number }> = {};
    rows.forEach((r: any) => {
      const t = (r.tarih || '').trim();
      if (!t) return;
      if (!gruplar[t]) gruplar[t] = { kaplama: 0, saatler: new Set(), tumSayi: 0 };
      gruplar[t].tumSayi += 1;
      if (r.saat) gruplar[t].saatler.add(r.saat);
      if (isKaplamaHizmeti(r.hizmet || '')) {
        gruplar[t].kaplama += 1;
      }
    });

    // Tarih aralığını gez
    const tarihler: Array<{
      tarih: string;
      durum: 'musait' | 'dolu' | 'kapali_pazar';
      kaplama_sayisi?: number;
      kalan_kaplama?: number;
      dolu_saatler?: string[];
      toplam_randevu?: number;
    }> = [];

    const cur = new Date(baslangic);
    while (cur < bitis) {
      const tarihStr = _formatla(cur);
      const isPazar = cur.getDay() === 0;

      if (isPazar) {
        tarihler.push({ tarih: tarihStr, durum: 'kapali_pazar' });
      } else {
        const grup = gruplar[tarihStr];
        const kaplama = grup ? grup.kaplama : 0;
        const saatler = grup ? Array.from(grup.saatler).sort() : [];
        const tumSayi = grup ? grup.tumSayi : 0;

        if (kaplama >= GUNLUK_KAPLAMA_LIMIT) {
          tarihler.push({
            tarih: tarihStr,
            durum: 'dolu',
            kaplama_sayisi: kaplama,
            kalan_kaplama: 0,
            dolu_saatler: saatler,
            toplam_randevu: tumSayi,
          });
        } else {
          tarihler.push({
            tarih: tarihStr,
            durum: 'musait',
            kaplama_sayisi: kaplama,
            kalan_kaplama: GUNLUK_KAPLAMA_LIMIT - kaplama,
            dolu_saatler: saatler,
            toplam_randevu: tumSayi,
          });
        }
      }

      cur.setDate(cur.getDate() + 1);
    }

    return NextResponse.json({
      success: true,
      data: {
        tarihler,
        kurallar: {
          gunluk_kaplama_limit: GUNLUK_KAPLAMA_LIMIT,
          pazar_kapali: true,
          calisma_saatleri: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
        },
      },
    });
  } catch (e: any) {
    console.error('[MUSAIT-TARIHLER] Hata:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
