/**
 * POST /api/odeme/paytr/bin
 *
 * Public endpoint - kart numarasinin ilk 6 hanesini alir,
 * PayTR BIN API'sine sorgu atip kart markasi/banka bilgisini doner.
 *
 * Body: { binNumber: "454360" } (6 hane)
 * Response: { success, data: { bank, brand, cardType, ... } }
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { odemeAyariOku } from '@/lib/odeme/ayarlar-okuyucu';

const BIN_API_URL = 'https://www.paytr.com/odeme/api/bin-detail';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const binNumber = String(body.binNumber || '').replace(/\D/g, '').slice(0, 8);

    if (binNumber.length < 6) {
      return NextResponse.json(
        { success: false, error: 'BIN numarasi en az 6 hane olmali' },
        { status: 400 }
      );
    }

    const ayar = await odemeAyariOku();
    if (!ayar || !ayar.paytrMerchantId || !ayar.paytrMerchantKey || !ayar.paytrMerchantSalt) {
      return NextResponse.json(
        { success: false, error: 'PayTR bilgileri eksik' },
        { status: 500 }
      );
    }

    // Hash: bin_number + merchant_id + merchant_salt
    const hashStr = binNumber + ayar.paytrMerchantId + ayar.paytrMerchantSalt;
    const paytrToken = crypto
      .createHmac('sha256', ayar.paytrMerchantKey)
      .update(hashStr)
      .digest('base64');

    const postData = new URLSearchParams({
      merchant_id: ayar.paytrMerchantId,
      bin_number: binNumber,
      paytr_token: paytrToken,
    }).toString();

    const response = await fetch(BIN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postData,
    });

    const rawText = await response.text();
    let paytrResponse: Record<string, unknown>;

    try {
      paytrResponse = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'PayTR yaniti parse edilemedi',
          raw: rawText.slice(0, 200),
        },
        { status: 500 }
      );
    }

    // PayTR yaniti: { status: 'success' | 'failed' | 'error', ... }
    if (paytrResponse.status === 'failed') {
      return NextResponse.json({
        success: false,
        data: null,
        error: 'BIN tanimli degil (yabanci kart olabilir)',
      });
    }

    if (paytrResponse.status === 'error') {
      return NextResponse.json({
        success: false,
        error: (paytrResponse.err_msg as string) || 'PayTR BIN sorgu hatasi',
      });
    }

    // Basarili: banka bilgilerini dondur
    return NextResponse.json({
      success: true,
      data: {
        bank: paytrResponse.bank || '',          // Banka adi
        brand: paytrResponse.brand || '',        // Kart markasi (Axess, Bonus, World...)
        cardType: paytrResponse.card_type || '', // credit/debit
        network: paytrResponse.network || '',    // Visa/Mastercard/Troy
        cardName: paytrResponse.card_name || '', // Klasik/Gold/Premium
        binNumber,
        raw: paytrResponse, // debug icin
      },
    });
  } catch (err) {
    console.error('[paytr/bin] Hata:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Sunucu hatasi',
      },
      { status: 500 }
    );
  }
}
