/**
 * POST /api/odeme/paytr/bildirim - v4
 *
 * v3'ten fark: Randevu guncellemesi artik HTTP fetch ile degil,
 * dogrudan DB sorgusu ile yapilir. Auth sorunu olmaz.
 *
 * PayTR webhook buraya POST atar, hash dogrulanir, borc ve randevu guncellenir.
 */

import { NextRequest } from 'next/server';
import { payTRConfigOku, bildirimHashDogrula } from '@/lib/odeme/paytr-client';
import {
  odemeIslendiMi,
  odemeIslendiOlarakIsaretle,
} from '@/lib/odeme/siparis-store';
import { borcDurumGuncelle } from '@/lib/odeme/borc-store';
import { sql, initDB } from '@/lib/db';

let dbReady = false;
async function ensureDB() {
  if (!dbReady) { await initDB(); dbReady = true; }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const merchantOid = formData.get('merchant_oid')?.toString() || '';
    const status = formData.get('status')?.toString() || '';
    const totalAmount = formData.get('total_amount')?.toString() || '';
    const hash = formData.get('hash')?.toString() || '';
    const failedReasonCode = formData.get('failed_reason_code')?.toString();
    const failedReasonMsg = formData.get('failed_reason_msg')?.toString();
    const paymentType = formData.get('payment_type')?.toString();
    const installmentCount = formData.get('installment_count')?.toString();

    console.log('[PayTR Bildirim] Geldi:', {
      merchantOid,
      status,
      totalAmount,
      paymentType,
      installmentCount,
      failedReasonCode,
    });

    if (!merchantOid || !status || !totalAmount || !hash) {
      console.error('[PayTR Bildirim] Eksik alan');
      return new Response('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const config = await payTRConfigOku();

    const dogru = bildirimHashDogrula(config, {
      merchant_oid: merchantOid,
      status: status as 'success' | 'failed',
      total_amount: totalAmount,
      hash,
    });

    if (!dogru) {
      console.error('[PayTR Bildirim] HASH DOGRULAMASI BASARISIZ!', {
        merchantOid,
      });
      return new Response('HASH_INVALID', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    if (odemeIslendiMi(merchantOid)) {
      console.log('[PayTR Bildirim] Zaten islendi:', merchantOid);
      return new Response('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    if (status === 'success') {
      console.log('[PayTR Bildirim] BASARILI ODEME:', {
        merchantOid,
        tutar: totalAmount,
        taksit: installmentCount,
      });

      odemeIslendiOlarakIsaretle(merchantOid, 'ODENDI');

      // Borc kaydini guncelle
      const odemeYontemi = paymentType === 'card' ? 'Kredi Karti' : paymentType || 'Kredi Karti';
      const taksit = installmentCount ? parseInt(installmentCount, 10) : 1;
      const borc = await borcDurumGuncelle(merchantOid, 'ODENDI', {
        odemeYontemi,
        taksit: isNaN(taksit) ? 1 : taksit,
      });

      if (borc) {
        console.log('[PayTR Bildirim] Borc guncellendi:', borc.kod);

        // === RANDEVU GUNCELLEMESI - DOGRUDAN DB ===
        // HTTP fetch yerine dogrudan SQL kullanilir (auth sorunu yok)
        if (borc.randevuId) {
          try {
            await ensureDB();

            // Randevuyu DB'den oku
            const rdvRows = await sql`
              SELECT * FROM randevular WHERE id = ${borc.randevuId} LIMIT 1
            ` as Array<{
              id: string;
              tutar: number;
              odenen_toplam: number;
              odeme_gecmisi: Array<{tarih: string; tutar: number; yontem: string; taksit?: number; siparisId?: string; borcKod?: string;}> | null;
              odendi: boolean;
              online_odeme: boolean;
            }>;

            if (rdvRows.length === 0) {
              console.log('[PayTR Bildirim] Randevu bulunamadi DB\'de:', borc.randevuId);
            } else {
              const rdv = rdvRows[0];

              // Mevcut odeme gecmisine ekle
              const eskiGecmis = Array.isArray(rdv.odeme_gecmisi) ? rdv.odeme_gecmisi : [];
              const yeniOdemeKaydi = {
                tarih: new Date().toISOString(),
                tutar: borc.tutar,
                yontem: 'PayTR ' + odemeYontemi,
                taksit: isNaN(taksit) ? 1 : taksit,
                siparisId: merchantOid,
                borcKod: borc.kod,
              };
              const yeniGecmis = [...eskiGecmis, yeniOdemeKaydi];

              // Yeni toplam odenen
              const yeniOdenenToplam = (Number(rdv.odenen_toplam) || 0) + borc.tutar;
              const yeniOdendi = yeniOdenenToplam >= Number(rdv.tutar);

              // DB'de UPDATE
              await sql`
                UPDATE randevular
                SET odenen_toplam = ${yeniOdenenToplam},
                    odendi = ${yeniOdendi},
                    online_odeme = TRUE,
                    odeme_gecmisi = ${JSON.stringify(yeniGecmis)}::jsonb,
                    guncelleme = NOW()
                WHERE id = ${borc.randevuId}
              `;

              console.log('[PayTR Bildirim] Randevu guncellendi:', {
                id: rdv.id,
                eskiOdenen: rdv.odenen_toplam,
                yeniOdenen: yeniOdenenToplam,
                toplam: rdv.tutar,
                odendi: yeniOdendi,
              });
            }
          } catch (rdvErr) {
            const msg = rdvErr instanceof Error ? rdvErr.message : String(rdvErr);
            console.error('[PayTR Bildirim] Randevu DB guncelleme hatasi:', msg);
            // Randevu guncellemesi basarisiz olsa bile callback basarili donmeli
          }
        } else {
          console.log('[PayTR Bildirim] Borc randevuya bagli degil (randevuId yok)');
        }
      } else {
        console.log('[PayTR Bildirim] Borc bulunamadi (manuel odeme?):', merchantOid);
      }
    } else {
      console.log('[PayTR Bildirim] BASARISIZ ODEME:', {
        merchantOid,
        hataKodu: failedReasonCode,
        hataMesaji: failedReasonMsg,
      });
      odemeIslendiOlarakIsaretle(merchantOid, 'HATALI');
      // Borc BEKLEMEDE'de kalir, musteri tekrar deneyebilir
    }

    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PayTR Bildirim] EXCEPTION:', msg);
    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

export async function GET() {
  return new Response(
    'PayTR Bildirim URL aktif. POST metoduyla PayTR sistemi tarafindan cagirilir.',
    {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }
  );
}
