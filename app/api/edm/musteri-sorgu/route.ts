/**
 * POST /api/edm/musteri-sorgu
 * VKN/TC ile musteri sorgulama (GIB e-fatura mukellef listesi)
 *
 * Akis:
 *   1. Login -> SessionID al
 *   2. checkGIBUser (SessionID ile) -> mukellef bilgisi don
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';
import { soapCagri, tagCek, xmlEsc, login } from '@/lib/edm/soap-client';

interface MusteriSorguIstegi {
  kullaniciAdi: string;
  sifre: string;
  testMod: boolean;
  tip: 'bireysel' | 'kurumsal';
  no: string;
}

interface MusteriSorguYaniti {
  bulundu: boolean;
  unvan?: string | null;
  etiket?: string | null;
  vergiDairesi?: string | null;
  mesaj: string;
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await req.json()) as MusteriSorguIstegi;

    if (!body.kullaniciAdi || !body.sifre) {
      if (!body.testMod) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'EDM kullanici bilgileri eksik' },
          { status: 400 }
        );
      }
    }
    if (!body.no) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'TC/VKN zorunlu' },
        { status: 400 }
      );
    }

    // === TEST MODU SIMULASYONU ===
    const simulasyon = !!body.testMod || !body.kullaniciAdi || !body.sifre;

    if (simulasyon) {
      if (body.tip === 'bireysel') {
        return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
          success: true,
          data: {
            bulundu: false,
            mesaj: '[TEST MODU] Bireysel musteriler icin e-Fatura mukellef sorgusu yapildi - GIB listesinde bulunamadi (simulasyon).',
          },
        });
      }
      const sonHane = parseInt(body.no.charAt(body.no.length - 1)) || 0;
      if (sonHane % 2 === 1) {
        return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
          success: true,
          data: {
            bulundu: true,
            unvan: '[TEST] ORNEK SIRKET LTD. STI.',
            etiket: 'urn:mail:defaultpk@ornekfirma.com.tr',
            vergiDairesi: '[TEST] SAMSUN VD',
            mesaj: '[TEST MODU] Musteri e-fatura mukellefi olarak bulundu (simulasyon)',
          },
        });
      } else {
        return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
          success: true,
          data: {
            bulundu: false,
            mesaj: '[TEST MODU] Bu VKN mukellef listesinde bulunamadi - e-Arsiv olarak kesilecek (simulasyon)',
          },
        });
      }
    }

    // === GERCEK EDM CAGRISI ===

    // 1) LOGIN - SessionID al
    const edmAuth = {
      kullaniciAdi: body.kullaniciAdi,
      sifre: body.sifre,
      testMod: false,
    };

    const loginSonuc = await login(edmAuth);
    if (!loginSonuc.basarili || !loginSonuc.sessionId) {
      return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
        success: true,
        data: {
          bulundu: false,
          mesaj: 'EDM login basarisiz: ' + (loginSonuc.hata?.mesaj || 'SessionID alinamadi') + ' - Bilgileri kontrol edin.',
        },
      });
    }

    const sessionId = loginSonuc.sessionId;

    // 2) checkGIBUser - VKN/TC ile mukellef sorgula
    const soapBody = `
      <checkGIBUserRequest xmlns="http://tempuri.org/">
        <REQUEST_HEADER xmlns="">
          <SESSION_ID>${xmlEsc(sessionId)}</SESSION_ID>
        </REQUEST_HEADER>
        <VKN_TCKN xmlns="">${xmlEsc(body.no)}</VKN_TCKN>
      </checkGIBUserRequest>`;

    const sonuc = await soapCagri('checkGIBUserRequest', soapBody, edmAuth);

    if (!sonuc.basarili) {
      const hataMesaj = sonuc.hata?.mesaj || 'Bilinmeyen hata';
      if (hataMesaj.toLowerCase().includes('not found') ||
          hataMesaj.toLowerCase().includes('bulunamad') ||
          hataMesaj.toLowerCase().includes('kayit yok') ||
          hataMesaj.includes('1003')) {
        return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
          success: true,
          data: {
            bulundu: false,
            mesaj: body.tip === 'bireysel'
              ? 'Bu TC GIB e-fatura mukellef listesinde bulunamadi - e-Arsiv olarak kesilecek.'
              : 'Bu VKN GIB e-fatura mukellef listesinde bulunamadi - e-Arsiv olarak kesilecek.',
          },
        });
      }
      return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
        success: true,
        data: {
          bulundu: false,
          mesaj: 'EDM sorgu hatasi: ' + hataMesaj,
        },
      });
    }

    const xml = sonuc.xml ?? '';
    const unvan = tagCek(xml, 'TITLE') || tagCek(xml, 'DEFINITION') || tagCek(xml, 'IDENTIFIER');
    const etiket = tagCek(xml, 'ALIAS') || tagCek(xml, 'URN') || tagCek(xml, 'IDENTIFIER');

    const returnCode = tagCek(xml, 'RETURN_CODE') || tagCek(xml, 'ERROR_CODE');
    if (returnCode && returnCode !== '0' && !unvan) {
      return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
        success: true,
        data: {
          bulundu: false,
          mesaj: body.tip === 'bireysel'
            ? 'Bu TC GIB e-fatura mukellef listesinde bulunamadi - e-Arsiv olarak kesilecek.'
            : 'Bu VKN GIB e-fatura mukellef listesinde bulunamadi - e-Arsiv olarak kesilecek.',
        },
      });
    }

    if (!unvan) {
      return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
        success: true,
        data: {
          bulundu: false,
          mesaj: body.tip === 'bireysel'
            ? 'Bu TC GIB e-fatura mukellef listesinde bulunamadi - e-Arsiv olarak kesilecek.'
            : 'Bu VKN GIB e-fatura mukellef listesinde bulunamadi - e-Arsiv olarak kesilecek.',
        },
      });
    }

    return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
      success: true,
      data: {
        bulundu: true,
        unvan,
        etiket,
        mesaj: 'Musteri e-fatura mukellefi olarak bulundu.',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('EDM musteri-sorgu hatasi:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatasi: ' + msg },
      { status: 500 }
    );
  }
}