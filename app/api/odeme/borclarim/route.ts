/**
 * GET /api/odeme/borclarim?telefon=05XX&email=abc@def.com
 *
 * Musteri kendi bekleyen ve gecmis borclarini gorur.
 * hesabim.html bu endpoint'i cagirir.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { musteriBorclari } from '@/lib/odeme/borc-store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telefon = searchParams.get('telefon') || undefined;
    const email = searchParams.get('email') || undefined;

    if (!telefon && !email) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Telefon veya email gerekli' },
        { status: 400 }
      );
    }

    const borclar = musteriBorclari({ telefon, email });

    // Gruplama: Bekleyenler ve gecmis
    const bekleyenler = borclar.filter((b) => b.durum === 'BEKLEMEDE');
    const gecmis = borclar.filter((b) => b.durum !== 'BEKLEMEDE');

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || 'https://www.autonax.com.tr'
    ).replace(/\/$/, '');

    // Her bekleyen icin odeme URL'i ekle
    const bekleyenlerUrlli = bekleyenler.map((b) => ({
      ...b,
      odemeUrl: `${siteUrl}/odeme/${b.kod}`,
    }));

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        bekleyenler: bekleyenlerUrlli,
        gecmis,
        ozet: {
          toplamBekleyenAdet: bekleyenler.length,
          toplamBekleyenTutar: bekleyenler.reduce((t, b) => t + b.tutar, 0),
          toplamOdenenAdet: gecmis.filter((b) => b.durum === 'ODENDI').length,
          toplamOdenenTutar: gecmis
            .filter((b) => b.durum === 'ODENDI')
            .reduce((t, b) => t + b.tutar, 0),
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Borclarim] Hata:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatasi' },
      { status: 500 }
    );
  }
}
