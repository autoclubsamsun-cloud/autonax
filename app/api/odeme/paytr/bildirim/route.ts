/**
 * POST /api/odeme/paytr/bildirim - v2
 *
 * Değişiklik: payTRConfigOku artık async
 */

import { NextRequest } from 'next/server';
import { payTRConfigOku, bildirimHashDogrula } from '@/lib/odeme/paytr-client';
import {
  odemeIslendiMi,
  odemeIslendiOlarakIsaretle,
} from '@/lib/odeme/siparis-store';

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

    // Config async oku
    const config = await payTRConfigOku();

    // Hash doğrula
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

    // Idempotency
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
      // TODO: Ürün stok, fatura, email vs. buradan tetiklenecek
    } else {
      console.log('[PayTR Bildirim] ✗ BASARISIZ ODEME:', {
        merchantOid,
        hataKodu: failedReasonCode,
        hataMesaji: failedReasonMsg,
      });
      odemeIslendiOlarakIsaretle(merchantOid, 'HATALI');
    }

    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PayTR Bildirim] EXCEPTION:', msg);
    // Hata olsa bile OK dön — PayTR spam etmesin
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
