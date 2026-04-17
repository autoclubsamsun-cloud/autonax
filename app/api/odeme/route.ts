import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';

interface OdemeIstegi {
  randevuId: string;
  tutar: number;
  gateway: 'iyzico' | 'paytr';
  musteri: { ad: string; tel: string; email?: string };
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json() as OdemeIstegi;
    const linkId = `PAY-${Date.now()}`;
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

// Webhook — gateway'den gelen callback (auth gerektirmez — gateway kendi doğrulamasını yapar)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    // TODO: Gateway imza doğrulaması ekle
    console.log('[Ödeme Webhook]', body);
    return NextResponse.json<ApiResponse>({ success: true, message: 'OK' });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Hata' }, { status: 500 });
  }
}
