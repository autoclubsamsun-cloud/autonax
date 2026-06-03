/**
 * POST /api/edm/iptal
 * EDM uzerinden fatura iptal
 */
import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';
import { login, cancelInvoice, tagCek } from '@/lib/edm/soap-client';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { kullaniciAdi, sifre, uuid, faturaNo } = body;

    if (!kullaniciAdi || !sifre || !uuid) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'kullaniciAdi, sifre ve uuid zorunlu' },
        { status: 400 }
      );
    }

    const edmAuth = { kullaniciAdi, sifre, testMod: false };

    const loginSonuc = await login(edmAuth);
    if (!loginSonuc.basarili || !loginSonuc.sessionId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'EDM login basarisiz: ' + (loginSonuc.hata?.mesaj || 'Bilinmeyen hata') },
        { status: 400 }
      );
    }

    const sonuc = await cancelInvoice(loginSonuc.sessionId, uuid, edmAuth);

    if (!sonuc.basarili) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'EDM iptal hatasi: ' + (sonuc.hata?.mesaj || 'Bilinmeyen hata') }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        mesaj: 'Fatura basariyla iptal edildi',
        faturaNo, uuid,
        returnCode: tagCek(sonuc.xml || '', 'RETURN_CODE'),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('EDM iptal hatasi:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatasi: ' + msg },
      { status: 500 }
    );
  }
}
