import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';

interface FaturaIstegi {
  randevuId: string;
  musteri: string;
  vknTckn?: string;
  tutar: number;
  kdvOrani: number;
  faturaTipi: 'EARSIV' | 'EFATURA';
  xsltIcerik?: string;
  not?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as FaturaIstegi;

    // TODO: EDM Bilişim SOAP API entegrasyonu
    // https://earsiv.ggmm.com.tr → WS endpoint

    const kdvsiz = Math.round(body.tutar / (1 + body.kdvOrani / 100));
    const kdvTutar = body.tutar - kdvsiz;
    const faturaNo = `AUT${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        faturaNo,
        faturaTipi: body.faturaTipi,
        musteri: body.musteri,
        tarih: new Date().toLocaleDateString('tr-TR'),
        kdvsizTutar: kdvsiz,
        kdvTutar,
        toplamTutar: body.tutar,
        durum: 'KESILDI',
      },
    });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Fatura kesilemedi' }, { status: 500 });
  }
}

// EDM bağlantı testi
export async function GET() {
  const edmUser = process.env.EDM_USERNAME;
  const testMod = process.env.NODE_ENV !== 'production';

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { bagli: !!edmUser, testMod, mesaj: testMod ? 'Test modunda çalışıyor' : 'Canlı bağlantı' },
  });
}
