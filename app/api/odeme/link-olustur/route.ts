/**
 * POST /api/odeme/link-olustur
 *
 * Admin panel bu endpoint'i cagirir, bir odeme linki uretir.
 * Donen URL'i WhatsApp/SMS ile musteriye gonderir.
 *
 * Body:
 * {
 *   musteriAdi: string,
 *   musteriTelefon: string,
 *   musteriEmail: string,
 *   tutar: number,
 *   aciklama: string,
 *   randevuId?: string,
 *   gecerlilikSaat?: number  // default 24
 * }
 *
 * Donen:
 * {
 *   success: true,
 *   data: {
 *     kod: "ABCD1234",
 *     siparisId: "AUTNX1234...",
 *     odemeUrl: "https://www.autonax.com.tr/odeme/ABCD1234",
 *     whatsappUrl: "https://wa.me/905XXX...?text=..."
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';
import { borcOlustur } from '@/lib/odeme/borc-store';
import { siparisIdUret } from '@/lib/odeme/paytr-client';

interface LinkOlusturIstegi {
  musteriAdi: string;
  musteriTelefon: string;
  musteriEmail: string;
  tutar: number;
  aciklama: string;
  musteriId?: string;
  randevuId?: string;
  gecerlilikSaat?: number;
}

interface LinkOlusturYaniti {
  kod: string;
  siparisId: string;
  odemeUrl: string;
  whatsappUrl: string;
  sonGecerlilik: string;
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await req.json()) as LinkOlusturIstegi;

    // Dogrulama
    const hata = girisDogrula(body);
    if (hata) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: hata },
        { status: 400 }
      );
    }

    // Siparis ID uret
    const siparisId = siparisIdUret();

    // Borc kaydi olustur
    const borc = await borcOlustur({
      siparisId,
      musteriAdi: body.musteriAdi.trim(),
      musteriTelefon: body.musteriTelefon.trim(),
      musteriEmail: body.musteriEmail.trim().toLowerCase(),
      tutar: body.tutar,
      aciklama: body.aciklama.trim(),
      musteriId: body.musteriId,
      randevuId: body.randevuId,
      olusturanKullanici: (auth as { username: string }).username,
      gecerlilikSaat: body.gecerlilikSaat ?? 24,
    });

    // URL uret (env'den site URL al)
    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || 'https://www.autonax.com.tr'
    ).replace(/\/$/, '');
    const odemeUrl = `${siteUrl}/odeme/${borc.kod}`;

    // WhatsApp URL uret
    const whatsappMetin = whatsappMetniOlustur({
      musteriAdi: borc.musteriAdi,
      tutar: borc.tutar,
      aciklama: borc.aciklama,
      odemeUrl,
    });
    const telefon = temizTelefon(borc.musteriTelefon);
    const whatsappUrl = telefon
      ? `https://wa.me/${telefon}?text=${encodeURIComponent(whatsappMetin)}`
      : `https://wa.me/?text=${encodeURIComponent(whatsappMetin)}`;

    return NextResponse.json<ApiResponse<LinkOlusturYaniti>>({
      success: true,
      data: {
        kod: borc.kod,
        siparisId: borc.siparisId,
        odemeUrl,
        whatsappUrl,
        sonGecerlilik: borc.sonGecerlilik,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Link Olustur] Hata:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatasi: ' + msg },
      { status: 500 }
    );
  }
}

function girisDogrula(b: LinkOlusturIstegi): string | null {
  if (!b.musteriAdi || b.musteriAdi.trim().length < 2) {
    return 'Musteri adi gerekli (en az 2 karakter)';
  }
  if (!b.musteriTelefon || b.musteriTelefon.replace(/\D/g, '').length < 10) {
    return 'Gecerli telefon numarasi gerekli';
  }
  if (!b.musteriEmail || !b.musteriEmail.includes('@')) {
    return 'Gecerli e-posta gerekli';
  }
  if (typeof b.tutar !== 'number' || b.tutar <= 0) {
    return 'Tutar pozitif bir sayi olmali';
  }
  if (!b.aciklama || b.aciklama.trim().length < 2) {
    return 'Aciklama gerekli';
  }
  if (b.gecerlilikSaat !== undefined && (b.gecerlilikSaat < 1 || b.gecerlilikSaat > 720)) {
    return 'Gecerlilik suresi 1-720 saat arasinda olmali';
  }
  return null;
}

/**
 * +90 veya 0 ile baslamasini kaldirir, Turkiye numarasi icin 90 ekler
 * Ornek: "0555 111 2233" -> "905551112233"
 */
function temizTelefon(tel: string): string {
  const sadeceRakam = tel.replace(/\D/g, '');
  if (sadeceRakam.length === 10) return '90' + sadeceRakam;
  if (sadeceRakam.length === 11 && sadeceRakam.startsWith('0')) {
    return '90' + sadeceRakam.slice(1);
  }
  if (sadeceRakam.length === 12 && sadeceRakam.startsWith('90')) {
    return sadeceRakam;
  }
  return sadeceRakam;
}

function whatsappMetniOlustur(params: {
  musteriAdi: string;
  tutar: number;
  aciklama: string;
  odemeUrl: string;
}): string {
  const ad = params.musteriAdi.split(' ')[0];
  const tutarStr = params.tutar.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    `Merhaba ${ad},\n\n` +
    `Autonax hizmet odemeniz hazir:\n\n` +
    `${params.aciklama}\n` +
    `Tutar: ${tutarStr} TL\n\n` +
    `Guvenli odeme icin tiklayin:\n${params.odemeUrl}\n\n` +
    `Link 24 saat gecerlidir.\n\n` +
    `Iyi gunler,\nAutonax`
  );
}
