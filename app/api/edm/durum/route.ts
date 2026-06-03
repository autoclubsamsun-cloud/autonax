/**
 * POST /api/edm/durum
 * EDM uzerinden fatura durum sorgulama
 */
import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';
import { login, getInvoiceStatus, tagCek } from '@/lib/edm/soap-client';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { kullaniciAdi, sifre, uuid } = body;

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

    const sonuc = await getInvoiceStatus(loginSonuc.sessionId, uuid, edmAuth);
    const xml = sonuc.xml || '';

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        basarili: sonuc.basarili,
        durum: tagCek(xml, 'STATUS') || null,
        durumAciklama: tagCek(xml, 'STATUS_DESCRIPTION') || null,
        gibDurum: tagCek(xml, 'GIB_STATUS_CODE') || null,
        gibAciklama: tagCek(xml, 'GIB_STATUS_DESCRIPTION') || null,
        cevapKodu: tagCek(xml, 'RESPONSE_CODE') || null,
        cevapAciklama: tagCek(xml, 'RESPONSE_DESCRIPTION') || null,
        hata: sonuc.hata?.mesaj || null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('EDM durum hatasi:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatasi: ' + msg },
      { status: 500 }
    );
  }
}
