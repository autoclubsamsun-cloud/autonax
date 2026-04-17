import { NextRequest, NextResponse } from 'next/server';
import { RANDEVULAR_DEMO } from '@/lib/data/randevular';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.toLowerCase();

  const map = new Map<string, { isim: string; tel: string; plaka: string; arac: string; islemSayisi: number; toplamTutar: number; sonTarih: string }>();

  RANDEVULAR_DEMO.forEach(r => {
    const key = r.musteri + r.plaka;
    const ex = map.get(key);
    if (ex) { ex.islemSayisi++; ex.toplamTutar += r.tutar; if (r.tarih > ex.sonTarih) ex.sonTarih = r.tarih; }
    else map.set(key, { isim: r.musteri, tel: r.tel, plaka: r.plaka, arac: r.arac, islemSayisi: 1, toplamTutar: r.tutar, sonTarih: r.tarih });
  });

  let data = Array.from(map.values());
  if (q) data = data.filter(m => m.isim.toLowerCase().includes(q) || m.plaka.toLowerCase().includes(q));

  return NextResponse.json<ApiResponse>({ success: true, data });
}
