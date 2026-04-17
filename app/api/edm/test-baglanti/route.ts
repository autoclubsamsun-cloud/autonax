/**
 * POST /api/edm/test-baglanti
 * EDM SOAP bağlantısını test eder (CheckUser operasyonu)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';
import { checkUser } from '@/lib/edm/operations';

interface TestBaglantiIstegi {
  kullaniciAdi: string;
  sifre: string;
  vknTckn?: string;
  gondericEtiketi?: string;
  testMod: boolean;
}

interface TestBaglantiYaniti {
  basarili: boolean;
  mesaj: string;
  firma?: string | null;
  kod?: string;
}

// Basit rate limit
const rateLimit = new Map<string, { sayac: number; reset: number }>();

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Rate limit — dakikada 5 deneme
  const ip =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    auth.username;
  const now = Date.now();
  const kayit = rateLimit.get(ip) || { sayac: 0, reset: now + 60_000 };
  if (now > kayit.reset) {
    kayit.sayac = 0;
    kayit.reset = now + 60_000;
  }
  kayit.sayac++;
  rateLimit.set(ip, kayit);
  if (kayit.sayac > 5) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Çok fazla deneme, 1 dakika sonra tekrar deneyin' },
      { status: 429 }
    );
  }

  try {
    const body = (await req.json()) as TestBaglantiIstegi;

    if (!body.kullaniciAdi || !body.sifre) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Kullanıcı adı ve şifre zorunlu' },
        { status: 400 }
      );
    }

    const sonuc = await checkUser({
      kullaniciAdi: body.kullaniciAdi,
      sifre: body.sifre,
      testMod: !!body.testMod,
    });

    const yanit: TestBaglantiYaniti = {
      basarili: sonuc.basarili,
      mesaj: sonuc.mesaj,
      firma: sonuc.firma,
      kod: sonuc.kod,
    };

    return NextResponse.json<ApiResponse<TestBaglantiYaniti>>({
      success: true,
      data: yanit,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('EDM test-baglanti hatası:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatası: ' + msg },
      { status: 500 }
    );
  }
}
