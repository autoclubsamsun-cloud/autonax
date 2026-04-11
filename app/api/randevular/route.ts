import { NextRequest, NextResponse } from 'next/server';
import { RANDEVULAR_DEMO } from '@/lib/data/randevular';
import type { Randevu, ApiResponse } from '@/lib/types';
import { randomUUID } from 'crypto';

// In-memory store (production: replace with DB)
let STORE: Randevu[] = [...RANDEVULAR_DEMO];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tarih = searchParams.get('tarih');
  const durum = searchParams.get('durum');
  const q    = searchParams.get('q')?.toLowerCase();

  let data = [...STORE];
  if (tarih) data = data.filter(r => r.tarih === tarih);
  if (durum) data = data.filter(r => r.durum === durum);
  if (q)     data = data.filter(r => r.musteri.toLowerCase().includes(q) || r.plaka.toLowerCase().includes(q));

  return NextResponse.json<ApiResponse<Randevu[]>>({ success: true, data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<Randevu, 'id'>;
    const yeni: Randevu = { ...body, id: `rdv-${randomUUID().slice(0, 8)}` };
    STORE.push(yeni);
    return NextResponse.json<ApiResponse<Randevu>>({ success: true, data: yeni }, { status: 201 });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Geçersiz istek' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as Randevu;
    const idx = STORE.findIndex(r => r.id === body.id);
    if (idx === -1) return NextResponse.json<ApiResponse>({ success: false, error: 'Randevu bulunamadı' }, { status: 404 });
    STORE[idx] = body;
    return NextResponse.json<ApiResponse<Randevu>>({ success: true, data: STORE[idx] });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Geçersiz istek' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: 'ID gerekli' }, { status: 400 });
  STORE = STORE.filter(r => r.id !== id);
  return NextResponse.json<ApiResponse>({ success: true, message: 'Silindi' });
}
