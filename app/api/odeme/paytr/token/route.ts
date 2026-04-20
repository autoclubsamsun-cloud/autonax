/**
 * POST /api/odeme/paytr/token - v2
 *
 * Değişiklikler (Sprint 1'den):
 * - payTRConfigOku artık async (Promise<PayTRConfig>)
 * - Config panelden okunuyor (Sunnet'in /api/ayarlar endpoint'i)
 * - Panel kapalıysa (paytrAktif=false) hata dönüyor
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
import type {
  OdemeBaslatIstegi,
  OdemeBaslatYaniti,
} from '@/lib/odeme/paytr-types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OdemeBaslatIstegi;

    // Giriş doğrulama
    const hata = girisDogrula(body);
    if (hata) {
      return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>({
        success: true,
        data: { basarili: false, hata },
      });
    }

    // PayTR aktif mi? (Panel toggle kontrolü)
    const aktif = await payTRAktifMi();
    if (!aktif) {
      return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>({
        success: true,
        data: {
          basarili: false,
          hata:
            'PayTR şu anda aktif değil. Admin panelinden etkinleştirilmeli.',
        },
      });
    }

    // Config oku (panelden veya .env fallback)
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

    // Sipariş ID
    const merchantOid = body.siparisId?.trim() || siparisIdUret();
    if (!/^[A-Za-z0-9]+$/.test(merchantOid)) {
      return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>({
        success: true,
        data: {
          basarili: false,
          hata:
            'Gecersiz siparis ID formati. Sadece harf ve rakam kullanilmalidir.',
        },
      });
    }

    // Tutar
    const tutarKurus = sepetToplamiKurus(body.sepet);
    if (tutarKurus <= 0) {
      return NextResponse.json<ApiResponse<OdemeBaslatYaniti>>({
        success: true,
        data: { basarili: false, hata: 'Sepet tutari sifirdan buyuk olmali' },
      });
    }

    // Müşteri IP
    const userIp = istekIpAl(req.headers);

    // Callback URL'ler
    const basariliUrl = `${config.siteUrl}/odeme-basarili.html?oid=${merchantOid}`;
    const basarisizUrl = `${config.siteUrl}/odeme-basarisiz.html?oid=${merchantOid}`;

    // PayTR'a istek
    const sonuc = await iFrameTokenAl({
      config,
      userIp,
      merchantOid,
      email: body.email,
      tutarKurus,
      sepet: body.sepet,
      musteriAdSoyad: body.adSoyad,
      musteriAdres: body.adres,
      musteriTelefon: body.telefon,
      basariliUrl,
      basarisizUrl,
      maxTaksit: body.maxTaksit,
      tekCekim: body.tekCekim,
      testModu: body.testModu,
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

function girisDogrula(b: OdemeBaslatIstegi): string | null {
  if (!b.email || !b.email.includes('@')) {
    return 'Gecerli bir e-posta gerekli';
  }
  if (!b.adSoyad || b.adSoyad.length < 2) {
    return 'Ad Soyad gerekli';
  }
  if (!b.telefon || b.telefon.length < 10) {
    return 'Telefon numarasi gerekli';
  }
  if (!b.adres || b.adres.length < 5) {
    return 'Adres gerekli';
  }
  if (!Array.isArray(b.sepet) || b.sepet.length === 0) {
    return 'Sepet bos olamaz';
  }
  for (const u of b.sepet) {
    if (!u.ad || typeof u.fiyat !== 'number' || typeof u.adet !== 'number') {
      return 'Sepet urunu eksik veya hatali';
    }
    if (u.fiyat <= 0 || u.adet <= 0) {
      return 'Urun fiyat ve adet pozitif olmali';
    }
  }
  return null;
}
