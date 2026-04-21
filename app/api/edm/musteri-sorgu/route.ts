/**
 * POST /api/edm/musteri-sorgu
 * VKN/TC ile müşteri sorgulama
 *
 * NOT: EDM'nin TC → müşteri bilgisi servisi YOK.
 * Bu endpoint sadece VKN için GİB e-fatura mükellef listesini sorgular.
 * TC sorgulama için NVI/KPS ayrı başvuru ister — şimdilik "bulunamadı" dönüyoruz.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';
import { soapCagri, tagCek, xmlEsc } from '@/lib/edm/soap-client';

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
  mesaj: string;
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await req.json()) as MusteriSorguIstegi;

    if (!body.kullaniciAdi || !body.sifre) {
      // Test modunda credentials zorunlu degil
      if (!body.testMod) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'EDM kullanıcı bilgileri eksik' },
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

    // ═══ TEST MODU SİMÜLASYONU ═══
    // Credentials yoksa veya testMod=true ise sahte başarılı yanıt dön
    const simulasyon = !!body.testMod || !body.kullaniciAdi || !body.sifre;

    if (simulasyon) {
      // Bireysel TC simulasyonu
      if (body.tip === 'bireysel') {
        return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
          success: true,
          data: {
            bulundu: false,
            mesaj:
              '[TEST MODU] Bireysel müşteriler için EDM sorgu servisi yoktur — alanları manuel doldurun.',
          },
        });
      }

      // Kurumsal VKN simulasyonu
      // VKN son hanesi tekse -> mükellef BULUNDU (e-Fatura)
      // VKN son hanesi çiftse -> BULUNAMADI (e-Arşiv)
      const sonHane = parseInt(body.no.charAt(body.no.length - 1)) || 0;
      if (sonHane % 2 === 1) {
        // Mukellef bulundu simulasyonu
        return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
          success: true,
          data: {
            bulundu: true,
            unvan: '[TEST] ÖRNEK ŞİRKET LTD. ŞTİ.',
            etiket: 'urn:mail:defaultpk@ornekfirma.com.tr',
            mesaj: '[TEST MODU] Müşteri e-fatura mükellefi olarak bulundu (simülasyon)',
          },
        });
      } else {
        return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
          success: true,
          data: {
            bulundu: false,
            mesaj:
              '[TEST MODU] Bu VKN mükellef listesinde bulunamadı — e-Arşiv olarak kesilecek (simülasyon)',
          },
        });
      }
    }

    // ═══ GERÇEK EDM ÇAĞRISI ═══

    // Bireysel (TC) için EDM'de servis yok
    if (body.tip === 'bireysel') {
      return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
        success: true,
        data: {
          bulundu: false,
          mesaj:
            'Bireysel müşteriler için EDM sorgulama servisi yoktur — alanları manuel doldurun.',
        },
      });
    }

    // Kurumsal: GİB e-fatura mükellef listesinde ara
    const soapBody = `
      <con:checkGIBUserRequest>
        <REQUEST_HEADER>
          <SESSION_ID></SESSION_ID>
        </REQUEST_HEADER>
        <INPUT>
          <VKN_TCKN>${xmlEsc(body.no)}</VKN_TCKN>
        </INPUT>
      </con:checkGIBUserRequest>`;

    const sonuc = await soapCagri('checkGIBUser', soapBody, {
      kullaniciAdi: body.kullaniciAdi,
      sifre: body.sifre,
      testMod: !!body.testMod,
    });

    if (!sonuc.basarili) {
      return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
        success: true,
        data: {
          bulundu: false,
          mesaj: sonuc.hata?.mesaj || 'Sorgulama başarısız',
        },
      });
    }

    const xml = sonuc.xml ?? '';
    const unvan = tagCek(xml, 'TITLE') || tagCek(xml, 'DEFINITION');
    const etiket = tagCek(xml, 'ALIAS') || tagCek(xml, 'URN');

    if (!unvan) {
      return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
        success: true,
        data: {
          bulundu: false,
          mesaj:
            'Bu VKN GİB e-fatura mükellef listesinde bulunamadı — e-Arşiv olarak kesilecek.',
        },
      });
    }

    return NextResponse.json<ApiResponse<MusteriSorguYaniti>>({
      success: true,
      data: {
        bulundu: true,
        unvan,
        etiket,
        mesaj: 'Müşteri e-fatura mükellefi olarak bulundu.',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('EDM musteri-sorgu hatası:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatası: ' + msg },
      { status: 500 }
    );
  }
}
