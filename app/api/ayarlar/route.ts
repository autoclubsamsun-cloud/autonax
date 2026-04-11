import { NextRequest, NextResponse } from 'next/server';
import type { SiteAyarlar, ApiResponse } from '@/lib/types';

// Default site ayarları
const DEFAULT: SiteAyarlar = {
  genel: { firmaAdi: 'Autonax Araç Koruma', slogan: 'Premium PPF & Seramik Kaplama', telefon: '0362 000 00 00', email: 'info@autonax.com', adres: 'Samsun, Türkiye', harita: '', calisma: 'Hft İçi 09:00–18:00' },
  seo: { title: 'Autonax | Premium PPF & Seramik Kaplama', description: 'Autonax ile aracınızı koruyun.', keywords: 'ppf, seramik, araç koruma' },
  sosyal: { instagram: '', facebook: '', whatsapp: '', youtube: '' },
  gorunurluk: { ppf: true, seramik: true, bakim: true, bayiler: true, blog: false },
};

let STORE: SiteAyarlar = { ...DEFAULT };

export async function GET() {
  return NextResponse.json<ApiResponse<SiteAyarlar>>({ success: true, data: STORE });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as Partial<SiteAyarlar>;
    STORE = { ...STORE, ...body };
    return NextResponse.json<ApiResponse<SiteAyarlar>>({ success: true, data: STORE });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Geçersiz istek' }, { status: 400 });
  }
}
