import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';

interface OdemeIstegi {
  randevuId: string;
  tutar: number;
  gateway: 'iyzico' | 'paytr';
  musteri: { ad: string; tel: string; email?: string };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as OdemeIstegi;

    // TODO: Gerçek gateway entegrasyonu
    // İyzico için: https://docs.iyzipay.com
    // PayTR için: https://www.paytr.com/magaza/api

    const linkId = `PAY-${Date.now()}`;

    // Simüle edilmiş ödeme linki
    const odemeLinki = `${process.env.NEXT_PUBLIC_APP_URL}/odeme/${linkId}?tutar=${body.tutar}&rdv=${body.randevuId}`;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        linkId,
        odemeLinki,
        gateway: body.gateway,
        tutar: body.tutar,
        durum: 'BEKLIYOR',
        olusturulma: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Ödeme linki oluşturulamadı' }, { status: 500 });
  }
}

// Webhook — gateway'den gelen callback
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    // Ödeme durumu güncelle
    console.log('[Ödeme Webhook]', body);
    return NextResponse.json<ApiResponse>({ success: true, message: 'OK' });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Hata' }, { status: 500 });
  }
}
