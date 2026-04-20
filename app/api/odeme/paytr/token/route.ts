/**
 * POST /api/odeme/paytr/token - v3
 *
 * v2'den fark: Artik iki modda calisir:
 *   1. "borc" modu: Body'de borcKod var, borc-store'dan bilgileri cekeriz
 *   2. "manuel" modu: Body'de tum bilgiler var, direkt PayTR token alir
 *
 * Body (borc modu):
 *   { borcKod: "ABCD1234" }
 *
 * Body (manuel modu - eski, testler icin):
 *   { email, adSoyad, telefon, adres, sepet: [{ad, fiyat, adet}], ... }
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import {
  payTRConfigOku,
  payTRAktifMi,
  iFrameTokenAl,
  istekIpAl,
  sepetToplamiKurus,
  siparisIdUret,
} from '@/lib/odeme/paytr-client';
import { borcBulKod } from '@/lib/odeme/borc-store';
import type {
  OdemeBaslatIstegi,
  OdemeBaslatYaniti,
  PayTRSepetUrunu,
} from '@/lib/odeme/paytr-types';

interface BorcModuIstegi {
  borcKod: string;
  adres?: string;  // PayTR icin adres gerekli ama borc'ta yok, varsayilan verilir
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Modu belirle
    const isBorcModu = typeof body.borcKod === 'string' && body.borcKod.length === 8;

    // PayTR aktif mi?
    const aktif = await payTRAktifMi();
    if (!aktif) {
      return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>({
        success: true,
        data: {
          basarili: false,
          hata: 'PayTR su anda aktif degil. Admin panelinden etkinlestirilmeli.',
        },
      });
    }

    // Config oku
    let config;
    try {
      config = await payTRConfigOku();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>(
        { success: true, data: { basarili: false, hata: msg } },
        { status: 500 }
      );
    }

    let merchantOid: string;
    let email: string;
    let adSoyad: string;
    let telefon: string;
    let adres: string;
    let sepet: PayTRSepetUrunu[];

    if (isBorcModu) {
      // BORC MODU - link uzerinden gelen musteri
      const borcData = body as BorcModuIstegi;
      const borc = borcBulKod(borcData.borcKod.toUpperCase());

      if (!borc) {
        return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>({
          success: true,
          data: { basarili: false, hata: 'Odeme linki bulunamadi' },
        });
      }
      if (borc.durum === 'ODENDI') {
        return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>({
          success: true,
          data: { basarili: false, hata: 'Bu borc zaten odenmis' },
        });
      }
      if (borc.durum === 'IPTAL') {
        return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>({
          success: true,
          data: { basarili: false, hata: 'Bu borc iptal edilmis' },
        });
      }
      if (borc.durum === 'SURESI_DOLDU') {
        return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>({
          success: true,
          data: { basarili: false, hata: 'Odeme linkinin suresi dolmus' },
        });
      }

      merchantOid = borc.siparisId;
      email = borc.musteriEmail;
      adSoyad = borc.musteriAdi;
      telefon = borc.musteriTelefon;
      adres = borcData.adres || 'Musteri adresi belirtilmemis';
      sepet = [{ ad: borc.aciklama, fiyat: borc.tutar, adet: 1 }];
    } else {
      // MANUEL MODU - gecici, test icin
      const b = body as OdemeBaslatIstegi;
      const hata = girisDogrulaManuel(b);
      if (hata) {
        return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>({
          success: true,
          data: { basarili: false, hata },
        });
      }
      merchantOid = b.siparisId?.trim() || siparisIdUret();
      email = b.email;
      adSoyad = b.adSoyad;
      telefon = b.telefon;
      adres = b.adres;
      sepet = b.sepet;
    }

    if (!/^[A-Za-z0-9]+$/.test(merchantOid)) {
      return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>({
        success: true,
        data: {
          basarili: false,
          hata: 'Gecersiz siparis ID formati',
        },
      });
    }

    const tutarKurus = sepetToplamiKurus(sepet);
    if (tutarKurus <= 0) {
      return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>({
        success: true,
        data: { basarili: false, hata: 'Tutar sifirdan buyuk olmali' },
      });
    }

    const userIp = istekIpAl(req.headers);
    const basariliUrl = `${config.siteUrl}/odeme-basarili?oid=${merchantOid}`;
    const basarisizUrl = `${config.siteUrl}/odeme-basarisiz?oid=${merchantOid}`;

    const sonuc = await iFrameTokenAl({
      config,
      userIp,
      merchantOid,
      email,
      tutarKurus,
      sepet,
      musteriAdSoyad: adSoyad,
      musteriAdres: adres,
      musteriTelefon: telefon,
      basariliUrl,
      basarisizUrl,
    });

    return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>({
      success: true,
      data: {
        basarili: sonuc.basarili,
        token: sonuc.token,
        siparisId: merchantOid,
        hata: sonuc.hata,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PayTR Token] Hata:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatasi: ' + msg },
      { status: 500 }
    );
  }
}

function girisDogrulaManuel(b: OdemeBaslatIstegi): string | null {
  if (!b.email || !b.email.includes('@')) return 'Gecerli e-posta gerekli';
  if (!b.adSoyad || b.adSoyad.length < 2) return 'Ad Soyad gerekli';
  if (!b.telefon || b.telefon.length < 10) return 'Telefon gerekli';
  if (!b.adres || b.adres.length < 5) return 'Adres gerekli';
  if (!Array.isArray(b.sepet) || b.sepet.length === 0) return 'Sepet bos';
  for (const u of b.sepet) {
    if (!u.ad || typeof u.fiyat !== 'number' || typeof u.adet !== 'number') {
      return 'Sepet urunu hatali';
    }
    if (u.fiyat <= 0 || u.adet <= 0) return 'Fiyat/adet pozitif olmali';
  }
  return null;
}
