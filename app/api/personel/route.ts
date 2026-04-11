import { NextRequest, NextResponse } from 'next/server';
import { PERSONEL_DEMO } from '@/lib/data/personel';
import type { Personel, ApiResponse } from '@/lib/types';
import { randomUUID } from 'crypto';

let STORE: Personel[] = [...PERSONEL_DEMO];

export async function GET() {
  // Şifreleri döndürme
  const safe = STORE.map(({ sifre: _, ...p }) => p);
  return NextResponse.json<ApiResponse<typeof safe>>({ success: true, data: safe });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<Personel, 'id'>;
    const yeni: Personel = { ...body, id: `p-${randomUUID().slice(0, 8)}` };
    STORE.push(yeni);
    return NextResponse.json<ApiResponse<Personel>>({ success: true, data: yeni }, { status: 201 });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Geçersiz istek' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as Personel;
    const idx = STORE.findIndex(p => p.id === body.id);
    if (idx === -1) return NextResponse.json<ApiResponse>({ success: false, error: 'Bulunamadı' }, { status: 404 });
    STORE[idx] = body;
    return NextResponse.json<ApiResponse<Personel>>({ success: true, data: STORE[idx] });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Geçersiz istek' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: 'ID gerekli' }, { status: 400 });
  STORE = STORE.filter(p => p.id !== id);
  return NextResponse.json<ApiResponse>({ success: true, message: 'Silindi' });
}
