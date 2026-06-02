/**
 * POST /api/edm/test-baglanti
 * EDM SOAP baglantilarini test eder
 * Hem test hem canli endpoint'i dener, hangisi calisirsa onu dondurur
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { requireAuth } from '@/lib/utils/auth-check';
import { login, type EdmAuth } from '@/lib/edm/soap-client';

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
  endpoint?: string;
  envelope?: string;
  xml?: string;
  testSonuclari?: {
    testEndpoint?: { basarili: boolean; mesaj: string; endpoint?: string };
    canliEndpoint?: { basarili: boolean; mesaj: string; endpoint?: string };
  };
}

// Basit rate limit
const rateLimit = new Map<string, { sayac: number; reset: number }>();

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

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
  if (kayit.sayac > 30) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Cok fazla deneme, 1 dakika sonra tekrar deneyin' },
      { status: 429 }
    );
  }

  try {
    const body = (await req.json()) as TestBaglantiIstegi;

    if (!body.kullaniciAdi || !body.sifre) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Kullanici adi ve sifre zorunlu' },
        { status: 400 }
      );
    }

    // Sifre decode
    let gercekSifre = body.sifre;
    if (gercekSifre.startsWith('b64:')) {
      try {
        gercekSifre = Buffer.from(gercekSifre.slice(4), 'base64').toString('utf-8');
      } catch { /* oldugu gibi kullan */ }
    }

    // Kullanicinin sectigi moda gore dene
    const seciliMod: EdmAuth = {
      kullaniciAdi: body.kullaniciAdi,
      sifre: gercekSifre,
      testMod: !!body.testMod,
    };

    console.log('[TEST-BAGLANTI] Secili mod:', body.testMod ? 'TEST' : 'CANLI');
    console.log('[TEST-BAGLANTI] Kullanici:', body.kullaniciAdi);
    const codes: number[] = []; for(let i=0;i<gercekSifre.length;i++) codes.push(gercekSifre.charCodeAt(i));
    console.log('[TEST-BAGLANTI] sifre uzunluk:', gercekSifre.length, 'charCodes:', codes);

    const sonuc = await login(seciliMod);

    if (sonuc.basarili && sonuc.sessionId) {
      return NextResponse.json<ApiResponse<TestBaglantiYaniti>>({
        success: true,
        data: {
          basarili: true,
          mesaj: `Baglanti basarili! SessionID alindi. (${body.testMod ? 'TEST' : 'CANLI'} mod)`,
          endpoint: sonuc.endpoint,
          envelope: sonuc.gonderilenEnvelope,
          xml: sonuc.xml,
        },
      });
    }

    // Basarisiz - detayli hata dondur
    // Diger modu da dene
    const digerMod: EdmAuth = {
      kullaniciAdi: body.kullaniciAdi,
      sifre: gercekSifre,
      testMod: !body.testMod,
    };

    console.log('[TEST-BAGLANTI] Secili mod basarisiz, diger mod deneniyor:', !body.testMod ? 'TEST' : 'CANLI');
    const digerSonuc = await login(digerMod);

    const testSonuclari = {
      [body.testMod ? 'testEndpoint' : 'canliEndpoint']: {
        basarili: false,
        mesaj: sonuc.hata?.mesaj || 'Bilinmeyen hata',
        endpoint: sonuc.endpoint,
      },
      [!body.testMod ? 'testEndpoint' : 'canliEndpoint']: {
        basarili: digerSonuc.basarili,
        mesaj: digerSonuc.basarili
          ? `Basarili! SessionID: ${digerSonuc.sessionId?.slice(0,8)}...`
          : (digerSonuc.hata?.mesaj || 'Basarisiz'),
        endpoint: digerSonuc.endpoint,
      },
    };

    // Diger mod calistiysa onu bildir
    if (digerSonuc.basarili) {
      return NextResponse.json<ApiResponse<TestBaglantiYaniti>>({
        success: true,
        data: {
          basarili: false,
          mesaj: `${body.testMod ? 'TEST' : 'CANLI'} modda basarisiz ama ${!body.testMod ? 'TEST' : 'CANLI'} modda calisiyor! Lutfen modu degistirin.`,
          endpoint: sonuc.endpoint,
          envelope: sonuc.gonderilenEnvelope,
          xml: sonuc.xml,
          testSonuclari,
        },
      });
    }

    // Her ikisi de basarisiz
    return NextResponse.json<ApiResponse<TestBaglantiYaniti>>({
      success: true,
      data: {
        basarili: false,
          mesaj: (sonuc.hata?.mesaj || 'Kullanici adi veya sifre hatali') + ' | Kullanici: ' + body.kullaniciAdi + ' | Sifre uzunluk: ' + gercekSifre.length + ' | b64: ' + body.sifre.startsWith('b64:') + ' | charCodes:' + JSON.stringify(codes),
        kod: sonuc.hata?.kod,
        endpoint: sonuc.endpoint,
        envelope: sonuc.gonderilenEnvelope,
        xml: sonuc.xml,
        testSonuclari,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('EDM test-baglanti hatasi:', msg);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Sunucu hatasi: ' + msg },
      { status: 500 }
    );
  }
}
