/**
 * POST /api/edm/gonder
 * Fatura EDM'e gönder (e-Fatura veya e-Arşiv)
 *
 * Test Modu: EDM_AYAR.testMod=true ise sahte başarılı yanıt döner
 * Canlı Mod: Gerçek EDM SOAP servisine gönderim yapar (credentials lazım)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';

interface FaturaGonderIstegi {
  // EDM ayarları
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
    musteriTip: 'bireysel' | 'kurumsal';
    vknTckn: string;
    alias?: string;
    tel?: string;
    email?: string;
    adres?: string;
    il?: string;
    ilce?: string;
    tarih: string;
    hizmet: string;
    kdvsizTutar: number;
    kdvTutar: number;
    kdvOrani: number;
    toplamTutar: number;
    not?: string;
  };
}

interface FaturaGonderYaniti {
  basarili: boolean;
  faturaUuid?: string;
  faturaNo?: string;
  durum?: string;
  ettn?: string; // elektronik belge ttn
  mesaj: string;
  testMod?: boolean;
  xsltKullanildi?: boolean;
}

function sahteUUID(): string {
  // RFC4122 v4 uyumlu sahte UUID üretimi
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function sahteETTN(): string {
  // GIB ETTN format: F + yıl + 13 hane sayı
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

    // ═══ ZORUNLU ALAN KONTROL ═══
    if (!f.musteri || !f.hizmet || !f.toplamTutar || f.toplamTutar <= 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Müşteri, hizmet veya tutar eksik' },
        { status: 400 }
      );
    }

    // ═══ SİMÜLASYON MODU ═══
    const simulasyon = !!body.testMod || !body.kullaniciAdi || !body.sifre;

    if (simulasyon) {
      // XSLT kontrol - ayarlarda yuklenmis mi
      const xsltTip = f.faturaTipi === 'EFATURA' ? body.xsltEfatura : body.xsltEarsiv;
      const xsltVarMi = !!(xsltTip && xsltTip.icerik && xsltTip.icerik.length > 0);

      // 800ms beklet - gercek servis gibi
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
          mesaj: `[TEST MODU] ${f.faturaTipi === 'EFATURA' ? 'e-Fatura' : 'e-Arşiv'} simülasyon olarak gönderildi. Canlı modda gerçekleşecek.`,
          testMod: true,
          xsltKullanildi: xsltVarMi,
        },
      });
    }

    // ═══ GERÇEK EDM SOAP ÇAĞRISI ═══
    // TODO: EDM credentials gelince burayi aktif et
    // - UBL-TR XML olustur (ubl-builder.ts kullan)
    // - XSLT ekle (EDM_AYAR.xsltEfatura / xsltEarsiv)
    // - sendInvoice SOAP cagrisi yap
    // - Yaniti parse et, UUID + ETTN dondur

    return NextResponse.json<ApiResponse<FaturaGonderYaniti>>({
      success: false,
      data: {
        basarili: false,
        mesaj: 'Canlı mod henüz aktif değil. EDM credentials girilince aktifleştirilecek.',
        testMod: false,
      },
    }, { status: 501 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('EDM fatura gonder hatasi:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatası: ' + msg },
      { status: 500 }
    );
  }
}
