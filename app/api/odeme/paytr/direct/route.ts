/**
 * POST /api/odeme/paytr/direct
 *
 * Direkt API ile odeme baslatir.
 * Musteri form'u -> bu endpoint -> PayTR.
 * PayTR 3D Secure HTML'i geri doner, musteriye gosterilir.
 *
 * Istek body:
 * {
 *   kod?: string,              // Borc kodu (varsa - borc odeme)
 *   ccOwner: string,           // Kart sahibi adi
 *   cardNumber: string,        // Kart numarasi
 *   expiryMonth: string,       // Ay (01-12)
 *   expiryYear: string,        // Yil (2 veya 4 haneli)
 *   cvv: string,               // CVV
 *   installmentCount?: number, // Taksit (0 = tek cekim)
 *   musteriNotu?: string,      // Musteri notu (opsiyonel)
 *
 *   // Manuel mod (kod olmadiginda):
 *   email?: string,
 *   adSoyad?: string,
 *   telefon?: string,
 *   adres?: string,
 *   sepet?: Array<{ad, fiyat, adet}>
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  directOdemeBaslat,
  siparisIdOlustur,
  type SepetUrunu,
} from '@/lib/odeme/paytr-direct-client';
import { borcBulKod } from '@/lib/odeme/borc-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Kart bilgileri zorunlu
    const { ccOwner, cardNumber, expiryMonth, expiryYear, cvv } = body;
    if (!ccOwner || !cardNumber || !expiryMonth || !expiryYear || !cvv) {
      return NextResponse.json(
        {
          success: false,
          error: 'Kart bilgileri eksik (cc_owner, card_number, expiry_month, expiry_year, cvv)',
        },
        { status: 400 }
      );
    }

    // Kart numarasi validasyonu (13-19 hane)
    const temizKart = cardNumber.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(temizKart)) {
      return NextResponse.json(
        { success: false, error: 'Kart numarasi gecersiz' },
        { status: 400 }
      );
    }

    // CVV validasyonu (3-4 hane)
    if (!/^\d{3,4}$/.test(cvv)) {
      return NextResponse.json(
        { success: false, error: 'CVV gecersiz' },
        { status: 400 }
      );
    }

    // IP adresi
    const userIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Taksit - default 0 (tek cekim)
    let installmentCount = 0;
    if (body.installmentCount) {
      const n = parseInt(body.installmentCount);
      if (n >= 2 && n <= 12) installmentCount = n;
    }

    // Borc kodu var mi?
    let merchantOid: string;
    let email: string;
    let musteriAdi: string;
    let telefon: string;
    let adres: string;
    let tutar: number;
    let sepet: SepetUrunu[];

    if (body.kod) {
      // Borc odeme modu
      const borc = borcBulKod(body.kod);
      if (!borc) {
        return NextResponse.json(
          { success: false, error: 'Odeme kodu bulunamadi veya gecersiz' },
          { status: 404 }
        );
      }
      if (borc.durum === 'ODENDI') {
        return NextResponse.json(
          { success: false, error: 'Bu borc zaten odenmis' },
          { status: 400 }
        );
      }
      if (new Date(borc.sonGecerlilik) < new Date()) {
        return NextResponse.json(
          { success: false, error: 'Odeme linkinin suresi dolmus' },
          { status: 400 }
        );
      }

      merchantOid = borc.siparisId;
      email = borc.musteriEmail || 'musteri@autonax.com.tr';
      musteriAdi = borc.musteriAdi;
      telefon = borc.musteriTelefon;
      adres = 'Autonax Musteri';
      tutar = borc.tutar;
      sepet = [
        {
          ad: borc.aciklama || 'Autonax Hizmeti',
          fiyat: borc.tutar,
          adet: 1,
        },
      ];
    } else {
      // Manuel mod
      if (!body.email || !body.adSoyad || !body.telefon || !body.sepet) {
        return NextResponse.json(
          {
            success: false,
            error: 'Manuel modda email, adSoyad, telefon, sepet zorunlu',
          },
          { status: 400 }
        );
      }

      merchantOid = siparisIdOlustur();
      email = body.email;
      musteriAdi = body.adSoyad;
      telefon = body.telefon;
      adres = body.adres || 'Autonax';
      sepet = body.sepet;
      tutar = sepet.reduce((s: number, u: SepetUrunu) => s + u.fiyat * u.adet, 0);
    }

    // Vade farki hesaplama - musteri oderse tutari arttir
    const vadeKarsilayanFirma = body.vadeKarsilayanFirma !== false; // default true
    const secilenMarka = body.secilenMarka || null;

    if (!vadeKarsilayanFirma) {
      // Musteri odeyecek - taksit oranlarini DB'den al
      try {
        const { sql, initDB } = await import('@/lib/db');
        await initDB();
        const rows = await sql`SELECT deger FROM site_ayarlar WHERE anahtar='taksit_oranlari'`;
        if (rows.length > 0 && rows[0].deger) {
          const oranlar = rows[0].deger as Record<string, Record<string, number>>;
          // Markayi sec - yoksa ilk markayi kullan
          const markalar = Object.keys(oranlar);
          let kullanilacakMarka: string | null = null;
          if (secilenMarka && oranlar[secilenMarka]) {
            kullanilacakMarka = secilenMarka;
          } else if (markalar.length > 0) {
            kullanilacakMarka = markalar[0];
          }

          if (kullanilacakMarka) {
            const ay = installmentCount === 0 ? 1 : installmentCount;
            const oran = oranlar[kullanilacakMarka][ay] || oranlar[kullanilacakMarka][String(ay)] || 0;
            if (oran > 0) {
              const ekVadeFarki = tutar * (oran / 100);
              tutar = tutar + ekVadeFarki;
              // Sepet'teki fiyati da guncelle (1 urun varsa)
              if (sepet.length === 1) {
                sepet[0].fiyat = tutar;
              } else {
                // Coklu sepet - oransal dagit
                const eskiToplam = sepet.reduce((s, u) => s + u.fiyat * u.adet, 0);
                sepet = sepet.map(u => ({
                  ...u,
                  fiyat: u.fiyat * (tutar / eskiToplam),
                }));
              }
              console.log('[Direct] Vade musteride - yeni tutar:', tutar.toFixed(2), 'oran:', oran, 'marka:', kullanilacakMarka);
            }
          }
        }
      } catch (err) {
        console.error('[Direct] Vade hesaplamasi hatasi:', err);
        // Hata durumunda orijinal tutari kullan
      }
    }

    // PayTR'a gonder
    const yanit = await directOdemeBaslat({
      merchantOid,
      tutar,
      email,
      userIp,
      musteriAdi,
      musteriAdres: adres,
      musteriTelefon: telefon,
      sepet,
      ccOwner,
      cardNumber: temizKart,
      expiryMonth,
      expiryYear,
      cvv,
      installmentCount,
      cardType: secilenMarka || undefined,
      musteriNotu: body.musteriNotu,
    });

    // Basarili - 3DS HTML'i dondur
    if (yanit.basarili && yanit.html3ds) {
      return NextResponse.json({
        success: true,
        data: {
          siparisId: merchantOid,
          html3ds: yanit.html3ds,
          type: '3ds_redirect',
        },
      });
    }

    // Sync mode basarili - direkt basarili sayfasina gitsin
    if (yanit.basarili && yanit.status === 'success') {
      return NextResponse.json({
        success: true,
        data: {
          siparisId: merchantOid,
          type: 'sync_success',
          redirectUrl: `/odeme-basarili?oid=${merchantOid}`,
        },
      });
    }

    // Basarisiz
    return NextResponse.json(
      {
        success: false,
        error: yanit.hata || 'PayTR odeme baslatilmadi',
        data: {
          siparisId: merchantOid,
          reasonCode: yanit.failedReasonCode,
          reasonMsg: yanit.failedReasonMsg,
        },
      },
      { status: 400 }
    );
  } catch (err) {
    console.error('[API paytr/direct] Hata:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Sunucu hatasi',
      },
      { status: 500 }
    );
  }
}
