/**
 * POST /api/odeme/paytr/sync
 *
 * Amac: borclar tablosundaki ODENDI olan ama randevu'ya yansimamis odemeleri
 * otomatik olarak randevu'ya islemek.
 *
 * Bu endpoint, PayTR bildirim gelmesine gerek kalmadan, DB'deki mevcut
 * veriyi kullanarak randevu guncellemesi yapar.
 *
 * Kullanim:
 *   - Admin panel acilisinda (toplu sync)
 *   - Randevu detayi acildiginda (tekil sync - { merchantOid } ile)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/utils/auth-check';

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

interface BorcRow {
  kod: string;
  siparis_id: string;
  tutar: number;
  durum: string;
  randevu_id: string | null;
  odeme_tarihi: string | null;
  odeme_yontemi: string | null;
  taksit: number | null;
}

interface RandevuRow {
  id: string;
  tutar: number;
  odenen_toplam: number;
  odeme_gecmisi: Array<{
    tarih: string;
    tutar: number;
    yontem: string;
    taksit?: number;
    siparisId?: string;
    borcKod?: string;
  }> | null;
  odendi: boolean;
  online_odeme: boolean;
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();

    // Istege gore tek siparis mi hepsi mi
    let merchantOid: string | null = null;
    try {
      const body = await req.json();
      merchantOid = body?.merchantOid || null;
    } catch {
      // body yoksa hepsini sync et
    }

    // ODENDI olan borclari cek
    let borclar: BorcRow[];
    if (merchantOid) {
      borclar = await sql`
        SELECT kod, siparis_id, tutar, durum, randevu_id, odeme_tarihi, odeme_yontemi, taksit
        FROM borclar
        WHERE siparis_id = ${merchantOid} AND durum = 'ODENDI' AND randevu_id IS NOT NULL
        LIMIT 1
      ` as unknown as BorcRow[];
    } else {
      borclar = await sql`
        SELECT kod, siparis_id, tutar, durum, randevu_id, odeme_tarihi, odeme_yontemi, taksit
        FROM borclar
        WHERE durum = 'ODENDI' AND randevu_id IS NOT NULL
        ORDER BY odeme_tarihi DESC NULLS LAST
        LIMIT 50
      ` as unknown as BorcRow[];
    }

    console.log('[PayTR Sync] Bulunan ODENDI borc sayisi:', borclar.length);

    const sonuclar: Array<{
      borcKod: string;
      siparisId: string;
      randevuId: string;
      durum: 'guncellendi' | 'zaten_var' | 'randevu_bulunamadi' | 'hata';
      mesaj?: string;
    }> = [];

    let guncellenenSayisi = 0;

    for (const borc of borclar) {
      if (!borc.randevu_id) continue;

      try {
        // Randevuyu cek
        const rdvRows = await sql`
          SELECT id, tutar, odenen_toplam, odeme_gecmisi, odendi, online_odeme
          FROM randevular
          WHERE id = ${borc.randevu_id}
          LIMIT 1
        ` as unknown as RandevuRow[];

        if (rdvRows.length === 0) {
          sonuclar.push({
            borcKod: borc.kod,
            siparisId: borc.siparis_id,
            randevuId: borc.randevu_id,
            durum: 'randevu_bulunamadi',
          });
          continue;
        }

        const rdv = rdvRows[0];
        const eskiGecmis = Array.isArray(rdv.odeme_gecmisi) ? rdv.odeme_gecmisi : [];

        // Bu borc daha once randevuya islenmis mi kontrol et
        const zatenVar = eskiGecmis.some(
          (g) => g.borcKod === borc.kod || g.siparisId === borc.siparis_id
        );

        if (zatenVar) {
          sonuclar.push({
            borcKod: borc.kod,
            siparisId: borc.siparis_id,
            randevuId: borc.randevu_id,
            durum: 'zaten_var',
          });
          continue;
        }

        // Odeme gecmisi olusumu
        const yeniOdemeKaydi = {
          tarih: borc.odeme_tarihi || new Date().toISOString(),
          tutar: Number(borc.tutar),
          yontem: 'PayTR ' + (borc.odeme_yontemi || 'Kredi Karti'),
          taksit: borc.taksit || 1,
          siparisId: borc.siparis_id,
          borcKod: borc.kod,
        };

        const yeniGecmis = [...eskiGecmis, yeniOdemeKaydi];
        const yeniOdenenToplam = (Number(rdv.odenen_toplam) || 0) + Number(borc.tutar);
        const yeniOdendi = yeniOdenenToplam >= Number(rdv.tutar);

        await sql`
          UPDATE randevular
          SET odenen_toplam = ${yeniOdenenToplam},
              odendi = ${yeniOdendi},
              online_odeme = TRUE,
              odeme_gecmisi = ${JSON.stringify(yeniGecmis)}::jsonb,
              guncelleme = NOW()
          WHERE id = ${borc.randevu_id}
        `;

        console.log('[PayTR Sync] Randevu guncellendi:', {
          randevuId: borc.randevu_id,
          borcKod: borc.kod,
          tutar: borc.tutar,
          yeniToplam: yeniOdenenToplam,
          odendi: yeniOdendi,
        });

        sonuclar.push({
          borcKod: borc.kod,
          siparisId: borc.siparis_id,
          randevuId: borc.randevu_id,
          durum: 'guncellendi',
        });

        guncellenenSayisi++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[PayTR Sync] Borc sync hatasi:', borc.kod, msg);
        sonuclar.push({
          borcKod: borc.kod,
          siparisId: borc.siparis_id,
          randevuId: borc.randevu_id || '',
          durum: 'hata',
          mesaj: msg,
        });
      }
    }

    return NextResponse.json({
      success: true,
      toplam: borclar.length,
      guncellendi: guncellenenSayisi,
      detay: sonuclar,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PayTR Sync] EXCEPTION:', msg);
    return NextResponse.json(
      { success: false, error: 'Sync hatasi: ' + msg },
      { status: 500 }
    );
  }
}

// GET - diagnostic/saglik kontrolu
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureDB();

    // ODENDI ama randevuya islenmemis olanlari bul
    const borclar = await sql`
      SELECT b.kod, b.siparis_id, b.tutar, b.randevu_id, b.odeme_tarihi
      FROM borclar b
      WHERE b.durum = 'ODENDI' AND b.randevu_id IS NOT NULL
      ORDER BY b.odeme_tarihi DESC NULLS LAST
      LIMIT 20
    ` as unknown as Array<{
      kod: string; siparis_id: string; tutar: number;
      randevu_id: string; odeme_tarihi: string | null;
    }>;

    return NextResponse.json({
      success: true,
      bulunan: borclar.length,
      borclar,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
