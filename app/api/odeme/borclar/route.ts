/**
 * GET /api/odeme/borclar?durum=BEKLEMEDE
 *
 * Admin tum borclari listeler. pnl_atn.html Odemeler sayfasi kullanir.
 *
 * DELETE /api/odeme/borclar/:kod - iptal (borcIptal)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';
import {
  tumBorclarListele,
  borcIptal,
  borcIstatistik,
  BorcDurumu,
} from '@/lib/odeme/borc-store';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const durum = searchParams.get('durum') as BorcDurumu | null;
    const telefon = searchParams.get('telefon') || undefined;

    const borclar = tumBorclarListele({
      durum: durum || undefined,
      telefon,
    });

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || 'https://www.autonax.com.tr'
    ).replace(/\/$/, '');

    // Her borca odeme URL'i ekle
    const borclarUrlli = borclar.map((b) => ({
      ...b,
      odemeUrl: `${siteUrl}/odeme/${b.kod}`,
    }));

    const istatistik = borcIstatistik();

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        borclar: borclarUrlli,
        istatistik,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatasi: ' + msg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/odeme/borclar - iptal
 * Body: { kod: "ABCD1234", islem: "iptal" }
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { kod, islem } = body;

    if (!kod) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Kod gerekli' },
        { status: 400 }
      );
    }

    if (islem === 'iptal') {
      const basarili = borcIptal(kod);
      if (!basarili) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: 'Borc bulunamadi veya zaten odenmis/iptal edilmis',
          },
          { status: 400 }
        );
      }
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { mesaj: 'Borc iptal edildi' },
      });
    }

    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Bilinmeyen islem' },
      { status: 400 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatasi: ' + msg },
      { status: 500 }
    );
  }
}
