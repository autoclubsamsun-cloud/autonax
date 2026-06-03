/**
 * POST /api/edm/musteri-sorgu
 * VKN/TC ile musteri sorgulama (GIB e-fatura mukellef listesi)
 *
 * Akis:
 *   1. Login -> SessionID al
 *   2. CheckUser (SessionID ile, IDENTIFIER = VKN/TC) -> mukellef bilgisi don
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';
import { login, checkGIBUser, getSupplier, tagCek, xmlEsc } from '@/lib/edm/soap-client';

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

  adres?: string | null;

  il?: string | null;

  ilce?: string | null;

  ulke?: string | null;

  telefon?: string | null;

  cepTelefon?: string | null;

  email?: string | null;

  kepEmail?: string | null;

  mersisNo?: string | null;

  webAdresi?: string | null;

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
            mesaj: '[TEST MODU] Bireysel musteriler icin sorgulandi - GIB listesinde bulunamadi (simulasyon).',
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

    const edmAuth = {
      kullaniciAdi: body.kullaniciAdi,
      sifre: body.sifre,
      testMod: false,
    };

    // 1) LOGIN - SessionID al
    const loginSonuc = await login(edmAuth);
    if (!loginSonuc.basarili || !loginSonuc.sessionId) {
      return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
        success: true,
        data: {
          bulundu: false,
          mesaj: 'EDM login basarisiz: ' + (loginSonuc.hata?.mesaj || 'SessionID alinamadi') + ' - Kullanici adi/sifre kontrol edin.',
        },
      });
    }

    // 2) CheckUser - WSDL'e gore dogru yapi
    const sonuc = await checkGIBUser(loginSonuc.sessionId, body.no, edmAuth);

    if (!sonuc.basarili) {
      const hataMesaj = sonuc.hata?.mesaj || 'Bilinmeyen hata';
      // "not found" veya benzer mesajlar = mukellef degil
      if (hataMesaj.toLowerCase().includes('not found') ||
          hataMesaj.toLowerCase().includes('bulunamad') ||
          hataMesaj.includes('1003') ||
          hataMesaj.includes('1006')) {
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
    // CheckUserResponse icindeki GIBUSER alanlari
    const unvan = tagCek(xml, 'TITLE') || tagCek(xml, 'DEFINITION') || tagCek(xml, 'IDENTIFIER');
    const etiket = tagCek(xml, 'ALIAS') || tagCek(xml, 'URN');
    const tip = tagCek(xml, 'TYPE');


    // Eger IDENTIFIER var ama TITLE yoksa
    const identifier = tagCek(xml, 'IDENTIFIER');

    // RETURN_CODE kontrolu
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

    // Bos CheckUserResponse - mukellef yok
    if (!identifier && !unvan && !etiket) {
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

    // Mukellef bulundu - GetSuppliers ile detay bilgilerini cek
    let adres: string | null = null, il: string | null = null, ilce: string | null = null, ulke: string | null = null;
    let telefon: string | null = null, cepTelefon: string | null = null, email: string | null = null, kepEmail: string | null = null;
    let vergiDairesi: string | null = null, mersisNo: string | null = null, webAdresi: string | null = null;

    try {
      const supplierSonuc = await getSupplier(loginSonuc.sessionId!, body.no, edmAuth);
      if (supplierSonuc.basarili && supplierSonuc.xml) {
        const sx = supplierSonuc.xml;
        adres = tagCek(sx, 'ADRES') || null;
        il = tagCek(sx, 'CITY') || null;
        ilce = tagCek(sx, 'COUNTY') || null;
        ulke = tagCek(sx, 'COUNTRY') || null;
        telefon = tagCek(sx, 'PHONE') || null;
        cepTelefon = tagCek(sx, 'MOBILE') || null;
        email = tagCek(sx, 'RESPONSIBLE_EMAIL') || null;
        kepEmail = tagCek(sx, 'KEP_EMAIL') || null;
        vergiDairesi = tagCek(sx, 'VERGI_DAIRESI') || null;
        mersisNo = tagCek(sx, 'MERSISNO') || null;
        webAdresi = tagCek(sx, 'WEBURI') || null;
      }
    } catch (e) {
      console.warn('GetSuppliers detay cekilemedi:', e);
    }

    return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
      success: true,
      data: {
        bulundu: true,
        unvan: unvan || identifier,
        etiket,
        vergiDairesi,
        adres,
        il,
        ilce,
        ulke,
        telefon,
        cepTelefon,
        email,
        kepEmail,
        mersisNo,
        webAdresi,
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
