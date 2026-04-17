import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';

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
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json() as FaturaIstegi;
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

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const edmUser = process.env.EDM_USERNAME;
  const testMod = process.env.NODE_ENV !== 'production';
  return NextResponse.json<ApiResponse>({
    success: true,
    data: { bagli: !!edmUser, testMod, mesaj: testMod ? 'Test modunda çalışıyor' : 'Canlı bağlantı' },
  });
}
