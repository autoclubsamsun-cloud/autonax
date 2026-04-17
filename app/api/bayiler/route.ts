import { NextRequest, NextResponse } from 'next/server';
import { BAYILER_DEMO } from '@/lib/data/bayiler';
import type { Bayi, ApiResponse } from '@/lib/types';
import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/utils/auth-check';

let STORE: Bayi[] = [...BAYILER_DEMO];

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json<ApiResponse<Bayi[]>>({ success: true, data: STORE });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json() as Omit<Bayi, 'id'>;
    const yeni: Bayi = { ...body, id: `b-${randomUUID().slice(0, 8)}` };
    STORE.push(yeni);
    return NextResponse.json<ApiResponse<Bayi>>({ success: true, data: yeni }, { status: 201 });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Geçersiz istek' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json() as Bayi;
    const idx = STORE.findIndex(b => b.id === body.id);
    if (idx === -1) return NextResponse.json<ApiResponse>({ success: false, error: 'Bulunamadı' }, { status: 404 });
    STORE[idx] = body;
    return NextResponse.json<ApiResponse<Bayi>>({ success: true, data: STORE[idx] });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Geçersiz istek' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: 'ID gerekli' }, { status: 400 });
  STORE = STORE.filter(b => b.id !== id);
  return NextResponse.json<ApiResponse>({ success: true, message: 'Silindi' });
}
