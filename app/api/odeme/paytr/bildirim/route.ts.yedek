/**
 * POST /api/odeme/paytr/bildirim - v3
 *
 * v2'den fark: Basarili odeme geldiginde borc-store'daki kayit guncellenir
 */

import { NextRequest } from 'next/server';
import { payTRConfigOku, bildirimHashDogrula } from '@/lib/odeme/paytr-client';
import {
  odemeIslendiMi,
  odemeIslendiOlarakIsaretle,
} from '@/lib/odeme/siparis-store';
import { borcDurumGuncelle } from '@/lib/odeme/borc-store';

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
      console.log('[PayTR Bildirim] ✓ BASARILI ODEME:', {
        merchantOid,
        tutar: totalAmount,
        taksit: installmentCount,
      });

      odemeIslendiOlarakIsaretle(merchantOid, 'ODENDI');

      // YENI: Borc kaydini guncelle
      const odemeYontemi = paymentType === 'card' ? 'Kredi Karti' : paymentType || 'Kredi Karti';
      const taksit = installmentCount ? parseInt(installmentCount, 10) : 1;
      const borc = await borcDurumGuncelle(merchantOid, 'ODENDI', {
        odemeYontemi,
        taksit: isNaN(taksit) ? 1 : taksit,
      });

      if (borc) {
        console.log('[PayTR Bildirim] Borc guncellendi:', borc.kod);

        // YENI: Borc randevuya bagliysa randevuyu da guncelle
        if (borc.randevuId) {
          try {
            const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.autonax.com.tr').replace(/\/$/, '');
            // Once randevuyu oku
            const rdvRes = await fetch(`${siteUrl}/api/randevular`, {
              method: 'GET',
            });
            const rdvData = await rdvRes.json();
            const rdvlar = rdvData.data || rdvData.randevular || [];
            const rdv = rdvlar.find((x: { id: string }) => x.id === borc.randevuId);

            if (rdv) {
              // Mevcut odeme gecmisine ekle
              if (!rdv.odemeGecmisi) rdv.odemeGecmisi = [];
              rdv.odemeGecmisi.push({
                tarih: new Date().toISOString(),
                tutar: borc.tutar,
                yontem: 'PayTR ' + odemeYontemi,
                taksit: isNaN(taksit) ? 1 : taksit,
                siparisId: merchantOid,
                borcKod: borc.kod,
              });
              // Toplam odeneni guncelle
              rdv.odenenToplam = (Number(rdv.odenenToplam) || 0) + borc.tutar;
              rdv.onlineOdeme = true;
              if (rdv.odenenToplam >= rdv.tutar) {
                rdv.odendi = true;
              }

              // POST ile kaydet (upsert)
              const updateRes = await fetch(`${siteUrl}/api/randevular`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rdv),
              });
              const updateJson = await updateRes.json();
              if (updateJson.success) {
                console.log('[PayTR Bildirim] Randevu guncellendi:', rdv.id);
              } else {
                console.error('[PayTR Bildirim] Randevu guncelleme hatasi:', updateJson.error);
              }
            } else {
              console.log('[PayTR Bildirim] Randevu bulunamadi:', borc.randevuId);
            }
          } catch (rdvErr) {
            console.error('[PayTR Bildirim] Randevu guncelleme istegi hatasi:', rdvErr);
            // Randevu guncellemesi basarisiz olsa bile callback basarili donmeli
          }
        } else {
          console.log('[PayTR Bildirim] Borc randevuya bagli degil (randevuId yok)');
        }
      } else {
        console.log('[PayTR Bildirim] Borc bulunamadi (manuel odeme?):', merchantOid);
      }
    } else {
      console.log('[PayTR Bildirim] ✗ BASARISIZ ODEME:', {
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
