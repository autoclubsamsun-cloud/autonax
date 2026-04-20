/**
 * GET /api/odeme/link/[kod]
 *
 * Musteri linke tikladiginda odeme.html bu endpoint'i cagirir,
 * borc detayini alir, sonra PayTR iframe'i baslatir.
 *
 * Donen:
 * {
 *   success: true,
 *   data: {
 *     kod: "ABCD1234",
 *     siparisId: "AUTNX...",
 *     musteriAdi: "...",
 *     tutar: 1500,
 *     aciklama: "Seramik kaplama",
 *     durum: "BEKLEMEDE" | "ODENDI" | "IPTAL" | "SURESI_DOLDU",
 *     sonGecerlilik: "2026-04-21T..."
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { borcBulKod } from '@/lib/odeme/borc-store';

// Next.js 15+ async params uyumlu. Eski surum icin asagida alternatif var.
type RouteContext = {
  params: Promise<{ kod: string }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { kod } = await context.params;

    if (!kod || kod.length !== 8) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Gecersiz odeme kodu' },
        { status: 400 }
      );
    }

    const borc = borcBulKod(kod.toUpperCase());
    if (!borc) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Odeme linki bulunamadi' },
        { status: 404 }
      );
    }

    // Musteri tarafina hassas alanlari gostermiyoruz (telefon, email tam gorunmesin)
    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        kod: borc.kod,
        siparisId: borc.siparisId,
        musteriAdi: borc.musteriAdi,
        musteriTelefonMaskeli: telefonMaskele(borc.musteriTelefon),
        musteriEmailMaskeli: emailMaskele(borc.musteriEmail),
        // Gercek deger PayTR icin lazim, bu yuzden tam olarak donduruyoruz
        musteriTelefon: borc.musteriTelefon,
        musteriEmail: borc.musteriEmail,
        tutar: borc.tutar,
        aciklama: borc.aciklama,
        durum: borc.durum,
        olusturmaTarihi: borc.olusturmaTarihi,
        sonGecerlilik: borc.sonGecerlilik,
        odemeTarihi: borc.odemeTarihi,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Link Detay] Hata:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatasi' },
      { status: 500 }
    );
  }
}

function telefonMaskele(tel: string): string {
  const temiz = tel.replace(/\D/g, '');
  if (temiz.length < 4) return tel;
  return temiz.slice(0, -4).replace(/./g, '*') + temiz.slice(-4);
}

function emailMaskele(email: string): string {
  const [ad, domain] = email.split('@');
  if (!ad || !domain) return email;
  if (ad.length <= 2) return email;
  return (
    ad[0] +
    ad.slice(1, -1).replace(/./g, '*') +
    ad[ad.length - 1] +
    '@' +
    domain
  );
}
