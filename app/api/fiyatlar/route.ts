import { NextRequest, NextResponse } from 'next/server';
import { URUNLER, SERAMIK, DIGER_HIZMETLER, KATEGORILER } from '@/lib/data/urunler';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json<ApiResponse>({
    success: true,
    data: { urunler: URUNLER, seramik: SERAMIK, diger: DIGER_HIZMETLER, kategoriler: KATEGORILER },
  });
}

export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    return NextResponse.json<ApiResponse>({ success: true, data: body, message: 'Fiyatlar güncellendi' });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Geçersiz istek' }, { status: 400 });
  }
}
