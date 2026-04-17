import { NextRequest, NextResponse } from 'next/server';
import { RANDEVULAR_DEMO } from '@/lib/data/randevular';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const donem = searchParams.get('donem') || 'bu-ay';
  const rdvlar = RANDEVULAR_DEMO;

  const toplamGelir = rdvlar.filter(r => r.odendi).reduce((s, r) => s + r.tutar, 0);
  const tamamlanan = rdvlar.filter(r => r.islem).length;
  const bekleyenOdeme = rdvlar.filter(r => !r.odendi).reduce((s, r) => s + Math.max(0, r.tutar - (r.odenenToplam || 0)), 0);
  const ortalamaIslem = tamamlanan > 0 ? Math.round(toplamGelir / tamamlanan) : 0;

  const hizmetSayisi: Record<string, number> = {};
  rdvlar.forEach(r => {
    const k = r.hizmet.split(' ').slice(0, 2).join(' ');
    hizmetSayisi[k] = (hizmetSayisi[k] || 0) + 1;
  });

  const odemeYontem: Record<string, number> = {};
  rdvlar.forEach(r => r.odemeGecmisi?.forEach(o => {
    odemeYontem[o.yontem] = (odemeYontem[o.yontem] || 0) + 1;
  }));

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      donem,
      ozet: { toplamGelir, tamamlanan, bekleyenOdeme, ortalamaIslem, toplamRandevu: rdvlar.length },
      hizmetSayisi,
      odemeYontem,
    },
  });
}
