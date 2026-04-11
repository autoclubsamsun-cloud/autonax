import { NextRequest, NextResponse } from 'next/server';
import { URUNLER, SERAMIK, DIGER_HIZMETLER, KATEGORILER } from '@/lib/data/urunler';
import type { ApiResponse } from '@/lib/types';

export async function GET() {
  return NextResponse.json<ApiResponse>({
    success: true,
    data: { urunler: URUNLER, seramik: SERAMIK, diger: DIGER_HIZMETLER, kategoriler: KATEGORILER },
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    // production: persist to DB
    return NextResponse.json<ApiResponse>({ success: true, data: body, message: 'Fiyatlar güncellendi' });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Geçersiz istek' }, { status: 400 });
  }
}
