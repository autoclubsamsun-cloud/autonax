/**
 * POST /api/edm/gonder
 * Fatura EDM'e gonder (e-Fatura veya e-Arsiv)
 *
 * Test Modu: testMod=true ise sahte basarili yanit doner
 * Canli Mod: Gercek EDM SOAP servisine gonderim yapar
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';
import { faturaGonder } from '@/lib/edm/operations';
import type { FaturaData, FaturaKalem, GondericiData } from '@/lib/edm/ubl-builder';

interface FaturaGonderIstegi {
  // EDM ayarlari
  kullaniciAdi: string;
  sifre: string;
  testMod: boolean;
  gondericEtiketi?: string;
  vknTckn?: string; // firma VKN
  xsltEarsiv?: { icerik: string };
  xsltEfatura?: { icerik: string };
  // Fatura bilgileri
  fatura: {
    faturaNo: string;
    faturaTipi: 'EARSIV' | 'EFATURA';
    musteri: string;
    musteriTip?: string;
    musteriTipi?: string;
    vknTckn: string;
    alias?: string;
    tel?: string;
    email?: string;
    telefon?: string;
    adres?: string;
    il?: string;
    ilce?: string;
    vergiDairesi?: string;
    tarih: string;
    hizmet?: string;
    kdvsizTutar: number;
    kdvTutar: number;
    kdvOrani: number;
    toplamTutar: number;
    kalemler?: FaturaKalem[];
    not?: string;
  };
}

interface FaturaGonderYaniti {
  basarili: boolean;
  faturaUuid?: string;
  faturaNo?: string;
  durum?: string;
  ettn?: string;
  mesaj: string;
  testMod?: boolean;
  xsltKullanildi?: boolean;
}

function sahteUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function sahteETTN(): string {
  const yil = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9e12) + 1e12;
  return `F${yil}${rand}`;
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await req.json()) as FaturaGonderIstegi;

    if (!body.fatura) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Fatura bilgileri eksik' },
        { status: 400 }
      );
    }

    const f = body.fatura;

    // Zorunlu alan kontrol
    if (!f.musteri || !f.toplamTutar || f.toplamTutar <= 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Musteri veya tutar eksik' },
        { status: 400 }
      );
    }

    // === SIMULASYON MODU ===
    const simulasyon = !!body.testMod || !body.kullaniciAdi || !body.sifre;

    if (simulasyon) {
      const xsltTip = f.faturaTipi === 'EFATURA' ? body.xsltEfatura : body.xsltEarsiv;
      const xsltVarMi = !!(xsltTip && xsltTip.icerik && xsltTip.icerik.length > 0);

      await new Promise(resolve => setTimeout(resolve, 800));

      const uuid = sahteUUID();
      const ettn = sahteETTN();

      return NextResponse.json<ApiResponse<FaturaGonderYaniti>>({
        success: true,
        data: {
          basarili: true,
          faturaUuid: uuid,
          faturaNo: f.faturaNo,
          durum: 'GONDERILDI',
          ettn: ettn,
          mesaj: `[TEST MODU] ${f.faturaTipi === 'EFATURA' ? 'e-Fatura' : 'e-Arsiv'} simulasyon olarak gonderildi.`,
          testMod: true,
          xsltKullanildi: xsltVarMi,
        },
      });
    }

    // === GERCEK EDM SOAP CAGRISI ===
    // Kalemler yoksa tek kalem olustur (eski wizard uyumu)
    const kalemler: FaturaKalem[] = (f.kalemler && f.kalemler.length > 0)
      ? f.kalemler
      : [{
          ad: f.hizmet || f.musteri + ' Hizmeti',
          adet: 1,
          fiyat: f.kdvsizTutar || f.toplamTutar,
          kdv: f.kdvOrani || 20,
        }];

    const faturaData: FaturaData = {
      faturaNo: f.faturaNo,
      faturaTipi: f.faturaTipi,
      musteriTipi: (f.musteriTipi || f.musteriTip || 'bireysel') as 'bireysel' | 'kurumsal',
      vknTckn: f.vknTckn,
      musteri: f.musteri,
      email: f.email || '',
      telefon: f.tel || f.telefon || '',
      adres: f.adres || '',
      il: f.il || '',
      ilce: f.ilce || '',
      vergiDairesi: f.vergiDairesi || '',
      tarih: f.tarih,
      kdvsizTutar: f.kdvsizTutar,
      kdvTutar: f.kdvTutar,
      kdvOrani: f.kdvOrani,
      toplamTutar: f.toplamTutar,
      kalemler,
    };

    const gonderici: GondericiData = {
      vknTckn: body.vknTckn || '',
      gondericEtiketi: body.gondericEtiketi || '',
      unvan: 'TEKNOTURK BILGI ISLEM TICARET',
      adres: '',
      il: 'Samsun',
      ilce: '',
      vergiDairesi: '',
    };

    // Sifre decode
    let gercekSifre = body.sifre;
    if (gercekSifre.startsWith('b64:')) {
      try {
        gercekSifre = Buffer.from(gercekSifre.slice(4), 'base64').toString('utf-8');
      } catch { /* olduğu gibi kullan */ }
    }

    // XSLT secimi
    const xsltIcerik = f.faturaTipi === 'EFATURA'
      ? (body.xsltEfatura?.icerik || undefined)
      : (body.xsltEarsiv?.icerik || undefined);

    const sonuc = await faturaGonder(
      faturaData,
      gonderici,
      {
        kullaniciAdi: body.kullaniciAdi,
        sifre: gercekSifre,
        testMod: false,
      },
      xsltIcerik
    );

    if (!sonuc.basarili) {
      return NextResponse.json<ApiResponse<FaturaGonderYaniti>>({
        success: false,
        data: {
          basarili: false,
          faturaNo: f.faturaNo,
          mesaj: 'EDM gonderim hatasi: ' + (sonuc.hata?.mesaj || 'Bilinmeyen'),
          testMod: false,
        },
        error: sonuc.hata?.mesaj || 'EDM hatasi',
      }, { status: 400 });
    }

    return NextResponse.json<ApiResponse<FaturaGonderYaniti>>({
      success: true,
      data: {
        basarili: true,
        faturaUuid: sonuc.uuid,
        faturaNo: sonuc.faturaNo || f.faturaNo,
        durum: 'GONDERILDI',
        mesaj: f.faturaTipi === 'EFATURA'
          ? 'e-Fatura EDM uzerinden basariyla gonderildi.'
          : 'e-Arsiv fatura EDM uzerinden basariyla gonderildi.',
        testMod: false,
      },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('EDM fatura gonder hatasi:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatasi: ' + msg },
      { status: 500 }
    );
  }
}
