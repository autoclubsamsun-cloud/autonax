/**
 * POST /api/odeme/paytr/iade - v2
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';
import { payTRConfigOku, tlToKurusString } from '@/lib/odeme/paytr-client';
import type {
  OdemeIadeIstegi,
  OdemeIadeYaniti,
} from '@/lib/odeme/paytr-types';
import crypto from 'crypto';

const PAYTR_IADE_URL = 'https://www.paytr.com/odeme/iade';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await req.json()) as OdemeIadeIstegi;

    if (!body.siparisId) {
      return NextResponse.json<ApiResponse<OdemeIadeYaniti>>({
        success: true,
        data: { basarili: false, mesaj: 'Siparis ID gerekli' },
      });
    }

    const config = await payTRConfigOku();
    const merchantOid = body.siparisId;

    const returnAmount = body.iadeTutari
      ? tlToKurusString(body.iadeTutari)
      : '';

    const hashStr =
      config.merchantId + merchantOid + returnAmount + config.merchantSalt;
    const hmac = crypto.createHmac('sha256', config.merchantKey);
    hmac.update(hashStr);
    const paytrToken = hmac.digest('base64');

    const form = new URLSearchParams({
      merchant_id: config.merchantId,
      merchant_oid: merchantOid,
      return_amount: returnAmount,
      paytr_token: paytrToken,
    });

    console.log('[PayTR Iade] Istek:', { merchantOid, returnAmount });

    const response = await fetch(PAYTR_IADE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const text = await response.text();
    console.log('[PayTR Iade] Yanit:', text.slice(0, 500));

    let json: { status?: string; err_no?: string; err_msg?: string };
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json<ApiResponse<OdemeIadeYaniti>>({
        success: true,
        data: {
          basarili: false,
          mesaj: 'PayTR gecerli JSON dondurmedi',
          hata: text.slice(0, 200),
        },
      });
    }

    if (json.status === 'success') {
      return NextResponse.json<ApiResponse<OdemeIadeYaniti>>({
        success: true,
        data: { basarili: true, mesaj: 'Iade basarili' },
      });
    }

    return NextResponse.json<ApiResponse<OdemeIadeYaniti>>({
      success: true,
      data: {
        basarili: false,
        mesaj: json.err_msg || 'Iade basarisiz',
        hata: json.err_no,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PayTR Iade] Exception:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatasi: ' + msg },
      { status: 500 }
    );
  }
}
