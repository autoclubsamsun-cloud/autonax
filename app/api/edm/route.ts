/**
 * POST /api/edm — Fatura kesimi (gerçek EDM SOAP çağrısı)
 * GET  /api/edm — EDM bağlantı durumu
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';
import { faturaGonder } from '@/lib/edm/operations';
import type { FaturaData, FaturaKalem, GondericiData } from '@/lib/edm/ubl-builder';

interface FaturaIstegi {
  // EDM bilgileri
  kullaniciAdi: string;
  sifre: string;
  testMod: boolean;

  // Gönderici
  gondericVknTckn: string;
  gondericEtiketi?: string;
  gonderici?: {
    unvan?: string;
    adres?: string;
    il?: string;
    ilce?: string;
    vergiDairesi?: string;
  };

  // Fatura (frontend'deki FATURALAR şeması)
  fatura: {
    faturaNo: string;
    faturaTipi: 'EARSIV' | 'EFATURA';
    musteriTipi: 'bireysel' | 'kurumsal';
    vknTckn: string;
    musteri: string;
    email: string;
    telefon?: string;
    adres: string;
    il: string;
    ilce: string;
    vergiDairesi?: string;
    tarih: string;
    kdvsizTutar: number;
    kdvTutar: number;
    kdvOrani: number;
    toplamTutar: number;
    kalemler: FaturaKalem[];
  };

  xslt?: {
    isim: string;
    icerik: string;
  };
}

interface FaturaKesimYaniti {
  faturaNo: string;
  uuid?: string;
  faturaTipi: string;
  musteri: string;
  tarih: string;
  kdvsizTutar: number;
  kdvTutar: number;
  toplamTutar: number;
  durum: 'KESILDI';
  edmGonderim: 'BASARILI' | 'HATA';
  edmHataKodu?: string;
  edmHataMesaji?: string;
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await req.json()) as FaturaIstegi;

    // Validasyon
    if (!body.kullaniciAdi || !body.sifre) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'EDM kullanıcı bilgileri eksik' },
        { status: 400 }
      );
    }
    if (!body.fatura || !body.fatura.faturaNo || !body.fatura.musteri) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Fatura bilgileri eksik' },
        { status: 400 }
      );
    }
    if (!body.fatura.kalemler || body.fatura.kalemler.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Fatura kalemleri eksik' },
        { status: 400 }
      );
    }
    if (!body.gondericVknTckn) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Gönderici VKN eksik' },
        { status: 400 }
      );
    }

    // EDM'ye gönderilecek fatura objesi
    const fatura: FaturaData = body.fatura;

    const gonderici: GondericiData = {
      vknTckn: body.gondericVknTckn,
      gondericEtiketi: body.gondericEtiketi,
      unvan: body.gonderici?.unvan || 'AUTONAX',
      adres: body.gonderici?.adres || '',
      il: body.gonderici?.il || 'İstanbul',
      ilce: body.gonderici?.ilce || '',
      vergiDairesi: body.gonderici?.vergiDairesi || '',
    };

    const xsltIcerik = body.xslt?.icerik || undefined;

    // Gerçek SOAP çağrısı
    // b64: prefix'li şifreyi çöz
    let gercekSifre = body.sifre;
    if (gercekSifre.startsWith('b64:')) {
      try {
        gercekSifre = Buffer.from(gercekSifre.slice(4), 'base64').toString('utf-8');
      } catch {
        // Decode başarısızsa olduğu gibi kullan
      }
    }

    const sonuc = await faturaGonder(
      fatura,
      gonderici,
      {
        kullaniciAdi: body.kullaniciAdi,
        sifre: gercekSifre,
        testMod: !!body.testMod,
      },
      xsltIcerik
    );

    // Başarısızsa hatayı döndür (yerel kayıt için frontend devam eder)
    if (!sonuc.basarili) {
      const yanit: FaturaKesimYaniti = {
        faturaNo: fatura.faturaNo,
        faturaTipi: fatura.faturaTipi,
        musteri: fatura.musteri,
        tarih: fatura.tarih,
        kdvsizTutar: fatura.kdvsizTutar,
        kdvTutar: fatura.kdvTutar,
        toplamTutar: fatura.toplamTutar,
        durum: 'KESILDI',
        edmGonderim: 'HATA',
        edmHataKodu: sonuc.hata?.kod,
        edmHataMesaji: sonuc.hata?.mesaj,
      };
      return NextResponse.json<ApiResponse<FaturaKesimYaniti>>(
        {
          success: false,
          data: yanit,
          error: sonuc.hata?.mesaj || 'EDM hatası',
        },
        { status: 400 }
      );
    }

    // Başarılı
    const yanit: FaturaKesimYaniti = {
      faturaNo: sonuc.faturaNo || fatura.faturaNo,
      uuid: sonuc.uuid,
      faturaTipi: fatura.faturaTipi,
      musteri: fatura.musteri,
      tarih: fatura.tarih,
      kdvsizTutar: fatura.kdvsizTutar,
      kdvTutar: fatura.kdvTutar,
      toplamTutar: fatura.toplamTutar,
      durum: 'KESILDI',
      edmGonderim: 'BASARILI',
    };

    return NextResponse.json<ApiResponse<FaturaKesimYaniti>>({
      success: true,
      data: yanit,
      message: 'Fatura EDM\'ye başarıyla gönderildi',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('EDM fatura kesme hatası:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatası: ' + msg },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const edmUser = process.env.EDM_USERNAME;
  const testMod = process.env.NODE_ENV !== 'production';

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      bagli: !!edmUser,
      testMod,
      mesaj: testMod ? 'Test modunda çalışıyor' : 'Canlı bağlantı',
    },
  });
}
